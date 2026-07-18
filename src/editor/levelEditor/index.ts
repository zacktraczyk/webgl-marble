import type { Vec2 } from "../../engine/core/transform";
import type Stage from "../../engine/stage";
import type { GridLayout } from "../../game/level/grid";
import {
  isPusherTool,
  SelectedTool,
  type PusherTool,
} from "../tools";
import type { LevelObjectData } from "../../game/level/document";
import type {
  EditorGesture,
  PusherPlacementPreview,
  SelectionMarquee,
  WallDraft,
  WallEndpointFeedback,
} from "./gestures";
import {
  createGestureHost,
  type GestureHostController,
} from "./gestureHost";
import {
  findWallEndpointTarget,
  type HandleTestDeps,
  type WallEndpointTarget,
} from "./handles";
import {
  isCreationToolActive,
  updateCursor as applyIdleCursor,
  updateIdleState as applyIdleState,
  type IdleCursorContext,
} from "./idleCursor";
import { LevelEditorKeyboard } from "./keyboard";
import {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  type PointerGestureHost,
} from "./pointerGestures";
import { LevelEditorSelection } from "./selection";
import { type SnapDeps } from "./snap";
import {
  applyLevelObjectShape,
  getLevelObjectShape,
  getWallEndpoints,
  moveShape,
  setWallEndpoints,
} from "../../game/level/geometry";

type EditorCallbacks = {
  onObjectsChange(objects: readonly LevelObjectData[]): void;
  onObjectsCommit(objects: readonly LevelObjectData[]): void;
  onDelete(objects: readonly LevelObjectData[]): void;
  onCreateWall(start: Vec2, end: Vec2): LevelObjectData;
  onPlaceObject(tool: PusherTool, position: Vec2): LevelObjectData;
  onToolRequest(tool: SelectedTool): void;
  onToolComplete(tool: SelectedTool): void;
  onUndo(): void;
  onRedo(): void;
  onReset(): void;
};

type EditorCameraControls = {
  panByScreen(deltaX: number, deltaY: number): void;
  handleWheel(screenPoint: Vec2, event: WheelEvent): void;
};

export type {
  PusherPlacementPreview,
  SelectionMarquee,
  WallDraft,
  WallEndpointFeedback,
} from "./gestures";
export type {
  WallEndpointExclusion,
  WallEndpointTarget,
} from "./handles";
export { EditorOverlay } from "./overlay";

export class LevelEditorController {
  private readonly stage: Stage;
  private readonly cameraControls: EditorCameraControls;
  private readonly getObjects: () => readonly LevelObjectData[];
  private readonly getDefaultWallThickness: () => number;
  private readonly getGridSnapEnabled: () => boolean;
  private readonly getGridLayout: () => GridLayout;
  private readonly callbacks: EditorCallbacks;
  private gesture: EditorGesture | null = null;
  private activeTool = SelectedTool.Pointer;
  private readOnly = false;
  private readonly keyboard: LevelEditorKeyboard;
  private lastPointerScreen: Vec2 | null = null;
  private readonly selection: LevelEditorSelection;
  private wallAnchor: Vec2 | null = null;
  private wallPreviewEnd: Vec2 | null = null;
  private endpointFeedback: WallEndpointFeedback | null = null;
  private placementPreviewPosition: Vec2 | null = null;
  /** Persistent host shared with pointerGestures — created once, not per event. */
  private readonly gestureHost: PointerGestureHost;

  constructor({
    stage,
    cameraControls,
    getObjects,
    getDefaultWallThickness,
    getGridSnapEnabled,
    getGridLayout,
    callbacks,
    signal,
  }: {
    stage: Stage;
    cameraControls: EditorCameraControls;
    getObjects: () => readonly LevelObjectData[];
    getDefaultWallThickness: () => number;
    getGridSnapEnabled: () => boolean;
    getGridLayout: () => GridLayout;
    callbacks: EditorCallbacks;
    signal: AbortSignal;
  }) {
    this.stage = stage;
    this.cameraControls = cameraControls;
    this.getObjects = getObjects;
    this.getDefaultWallThickness = getDefaultWallThickness;
    this.getGridSnapEnabled = getGridSnapEnabled;
    this.getGridLayout = getGridLayout;
    this.callbacks = callbacks;
    this.selection = new LevelEditorSelection(getObjects);

    stage.canvas.addEventListener("pointerdown", this.pointerDown, { signal });
    stage.canvas.addEventListener("pointermove", this.pointerMove, { signal });
    stage.canvas.addEventListener("pointerup", this.pointerUp, { signal });
    stage.canvas.addEventListener("pointercancel", this.pointerCancel, {
      signal,
    });
    stage.canvas.addEventListener("pointerleave", this.pointerLeave, {
      signal,
    });
    stage.canvas.addEventListener("wheel", this.wheel, {
      signal,
      passive: false,
    });
    this.keyboard = new LevelEditorKeyboard(
      {
        undo: () => {
          this.cancelGesture();
          this.callbacks.onUndo();
        },
        redo: () => {
          this.cancelGesture();
          this.callbacks.onRedo();
        },
        selectAll: this.selectAll,
        escape: this.handleEscape,
        finishWall: this.finishWall,
        reset: () => {
          if (!this.readOnly) {
            return false;
          }
          this.callbacks.onReset();
          return true;
        },
        requestTool: (tool) => {
          if (!this.readOnly || tool === SelectedTool.Pan) {
            this.callbacks.onToolRequest(tool);
          }
        },
        deleteSelection: this.deleteSelection,
        nudgeSelection: this.nudgeSelection,
        modifierChanged: this.handleSelectionModifierChange,
        spaceChanged: () => this.updateCursor(),
        blur: this.handleWindowBlur,
      },
      signal
    );
    // Private fields exist at runtime; TS can't see them across the module boundary.
    this.gestureHost = createGestureHost(
      this as unknown as GestureHostController
    );
  }

  setActiveTool(tool: SelectedTool) {
    if (this.activeTool !== tool) {
      this.cancelGesture();
      this.clearWallAnchor();
    }
    this.activeTool = tool;
    this.selection.setHovered(null);
    this.endpointFeedback = null;
    this.placementPreviewPosition = null;
    this.updateCursor();
  }

  setReadOnly(readOnly: boolean) {
    if (readOnly && !this.readOnly) {
      this.cancelGesture();
      this.clearWallAnchor();
      this.selection.setHovered(null);
      this.endpointFeedback = null;
      this.placementPreviewPosition = null;
    }
    this.readOnly = readOnly;
    this.updateCursor();
  }

  clearSelection() {
    this.selection.clearAll();
  }

  get isActive() {
    return (
      this.activeTool === SelectedTool.Pointer ||
      this.selection.size > 0 ||
      this.wallAnchor !== null ||
      this.endpointFeedback !== null ||
      this.pusherPlacementPreview !== null ||
      this.gesture?.kind === "wall" ||
      this.gesture?.kind === "marquee"
    );
  }

  get selectedObjects() {
    return this.selection.selectedObjects;
  }

  get selectedObject() {
    return this.selection.selectedObject;
  }

  get hoveredObject() {
    return this.selection.hoveredObject;
  }

  get wallDraft(): WallDraft | null {
    if (this.gesture?.kind === "wall") {
      return {
        start: [...this.gesture.start],
        end: [...this.gesture.end],
        thickness: this.getDefaultWallThickness(),
      };
    }
    if (this.wallAnchor) {
      return {
        start: [...this.wallAnchor],
        end: [...(this.wallPreviewEnd ?? this.wallAnchor)],
        thickness: this.getDefaultWallThickness(),
      };
    }
    return null;
  }

  get selectionMarquee(): SelectionMarquee | null {
    return this.gesture?.kind === "marquee" && this.gesture.changed
      ? {
          start: [...this.gesture.startWorld],
          end: [...this.gesture.currentWorld],
        }
      : null;
  }

  get wallEndpointFeedback() {
    return this.endpointFeedback
      ? {
          ...this.endpointFeedback,
          position: [...this.endpointFeedback.position] as Vec2,
        }
      : null;
  }

  get pusherPlacementPreview(): PusherPlacementPreview | null {
    return isPusherTool(this.activeTool) && this.placementPreviewPosition
      ? {
          tool: this.activeTool,
          position: [...this.placementPreviewPosition],
        }
      : null;
  }

  private findObject(id: string | null) {
    if (!id) {
      return null;
    }
    return this.getObjects().find((object) => object.id === id) ?? null;
  }

  private get handleDeps(): HandleTestDeps {
    return {
      worldToScreen: (point) =>
        this.stage.camera.worldToScreen(...point) as Vec2,
      screenDistance: this.screenDistance.bind(this),
      getObjects: this.getObjects,
      getDefaultWallThickness: this.getDefaultWallThickness,
      cameraZoom: this.stage.camera.zoom,
    };
  }

  private get snapDeps(): SnapDeps {
    return {
      worldToScreen: (point) =>
        this.stage.camera.worldToScreen(...point) as Vec2,
      getGridSnapEnabled: this.getGridSnapEnabled,
      getGridLayout: this.getGridLayout,
      findWallEndpointTarget: (screenPoint, maximumDistance, options) =>
        findWallEndpointTarget(
          this.handleDeps,
          screenPoint,
          maximumDistance,
          options
        ),
      setEndpointFeedback: (target, kind) =>
        this.showEndpointFeedback(target, kind),
    };
  }

  private get dragDeps() {
    return {
      screenDistance: this.screenDistance.bind(this),
      getDefaultWallThickness: this.getDefaultWallThickness,
      getGridSnapEnabled: this.getGridSnapEnabled,
      getGridLayout: this.getGridLayout,
      getObjects: this.getObjects,
      findObject: (id: string) => this.findObject(id),
      onObjectsChange: this.callbacks.onObjectsChange.bind(this.callbacks),
    };
  }

  private get cameraZoom() {
    return this.stage.camera.zoom;
  }

  private get creationToolActive() {
    return isCreationToolActive(this.activeTool);
  }

  private get idleCursorContext(): IdleCursorContext {
    return {
      gesture: this.gesture,
      keyboard: this.keyboard,
      activeTool: this.activeTool,
      creationToolActive: this.creationToolActive,
      readOnly: this.readOnly,
      selection: this.selection,
      handleDeps: this.handleDeps,
      selectedObject: this.selectedObject,
      getObjects: this.getObjects,
      worldPoint: (screenPoint) => this.worldPoint(screenPoint),
      cameraZoom: this.cameraZoom,
      getDefaultWallThickness: this.getDefaultWallThickness,
      setCursor: (cursor) => this.setCursor(cursor),
      setEndpointFeedback: (feedback) => {
        this.endpointFeedback = feedback;
      },
      showEndpointFeedback: (target, kind) =>
        this.showEndpointFeedback(target, kind),
    };
  }

  private setCursor(cursor: string) {
    this.stage.canvas.style.cursor = cursor;
  }

  private screenPoint(event: PointerEvent | WheelEvent): Vec2 {
    const bounds = this.stage.canvas.getBoundingClientRect();
    return [event.clientX - bounds.left, event.clientY - bounds.top];
  }

  private worldPoint(screenPoint: Vec2): Vec2 {
    const [worldX, worldY] = this.stage.camera.screenToWorld(...screenPoint);
    return [worldX, worldY];
  }

  private capturePointer(pointerId: number) {
    this.stage.canvas.setPointerCapture(pointerId);
  }

  private releasePointer(pointerId: number) {
    if (this.stage.canvas.hasPointerCapture(pointerId)) {
      this.stage.canvas.releasePointerCapture(pointerId);
    }
  }

  private clearWallAnchor() {
    this.wallAnchor = null;
    this.wallPreviewEnd = null;
    this.endpointFeedback = null;
  }

  private rollbackGesture(gesture: EditorGesture) {
    if (gesture.kind === "move" && gesture.changed) {
      const restored: LevelObjectData[] = [];
      for (const [id, original] of gesture.originals) {
        const object = this.findObject(id);
        if (!object) {
          continue;
        }
        Object.assign(object, structuredClone(original));
        restored.push(object);
      }
      this.callbacks.onObjectsChange(restored);
      return;
    }

    if (
      (gesture.kind === "resize" || gesture.kind === "rotate") &&
      gesture.changed
    ) {
      const object = this.findObject(gesture.objectId);
      if (object) {
        applyLevelObjectShape(object, gesture.startShape);
        this.callbacks.onObjectsChange([object]);
      }
      return;
    }

    if (gesture.kind === "wall-endpoint" && gesture.changed) {
      const object = this.findObject(gesture.objectId);
      if (object?.prefab === "wall") {
        setWallEndpoints(object, gesture.start, gesture.end);
        this.callbacks.onObjectsChange([object]);
      }
      return;
    }

    if (gesture.kind === "motion-range" && gesture.changed) {
      const object = this.findObject(gesture.objectId);
      if (object) {
        object.motion = structuredClone(gesture.startMotion);
        this.callbacks.onObjectsChange([object]);
      }
      return;
    }

    if (gesture.kind === "marquee") {
      this.selection.replaceAll(gesture.initialSelection);
    }
  }

  private cancelGesture() {
    if (this.gesture) {
      const gesture = this.gesture;
      this.rollbackGesture(gesture);
      this.releasePointer(gesture.pointerId);
    }
    this.gesture = null;
    this.endpointFeedback = null;
    this.updateCursor();
  }

  private screenDistance(first: Vec2, second: Vec2) {
    return Math.hypot(first[0] - second[0], first[1] - second[1]);
  }

  private isTemporarySelection(modifier: {
    metaKey: boolean;
    ctrlKey: boolean;
  }) {
    return this.creationToolActive && (modifier.metaKey || modifier.ctrlKey);
  }

  private showEndpointFeedback(
    target: WallEndpointTarget | null,
    kind: WallEndpointFeedback["kind"]
  ) {
    this.endpointFeedback = target
      ? {
          objectId: target.objectId,
          endpoint: target.endpoint,
          position: [...target.position],
          kind,
        }
      : null;
  }

  private updateIdleState(
    screenPoint: Vec2,
    options?: { temporarySelection?: boolean }
  ) {
    applyIdleState(this.idleCursorContext, screenPoint, options);
  }

  private updateCursor() {
    applyIdleCursor(this.idleCursorContext);
  }

  private readonly pointerDown = (event: PointerEvent) => {
    handlePointerDown(this.gestureHost, event);
  };

  private readonly pointerMove = (event: PointerEvent) => {
    handlePointerMove(this.gestureHost, event);
  };

  private readonly pointerUp = (event: PointerEvent) => {
    handlePointerUp(this.gestureHost, event);
  };

  private readonly pointerCancel = (event: PointerEvent) => {
    if (this.gesture?.pointerId === event.pointerId) {
      this.cancelGesture();
    }
  };

  private readonly pointerLeave = () => {
    this.lastPointerScreen = null;
    this.placementPreviewPosition = null;
    if (!this.gesture) {
      this.selection.setHovered(null);
      this.endpointFeedback = null;
      this.updateCursor();
    }
  };

  private readonly wheel = (event: WheelEvent) => {
    const screenPoint = this.screenPoint(event);
    this.cameraControls.handleWheel(screenPoint, event);
    event.preventDefault();
  };

  private readonly selectAll = () => {
    if (this.readOnly) {
      return false;
    }
    this.selection.replaceAll(
      this.getObjects()
        .filter((object) => !object.locked)
        .map((object) => object.id)
    );
    return true;
  };

  private readonly handleEscape = () => {
    if (this.gesture) {
      this.cancelGesture();
    } else if (this.wallAnchor) {
      this.clearWallAnchor();
    } else if (this.activeTool !== SelectedTool.Pointer) {
      this.callbacks.onToolRequest(SelectedTool.Pointer);
    } else if (this.selection.size > 0) {
      this.clearSelection();
    }
    return true;
  };

  private readonly finishWall = () => {
    if (!this.wallAnchor) {
      return false;
    }
    this.clearWallAnchor();
    this.updateCursor();
    return true;
  };

  private readonly deleteSelection = () => {
    const selected = this.selectedObjects;
    if (selected.length === 0 || this.readOnly) {
      return false;
    }
    this.cancelGesture();
    this.callbacks.onDelete(selected);
    this.clearSelection();
    return true;
  };

  private readonly nudgeSelection = (direction: Vec2, distance: number) => {
    const selected = this.selectedObjects;
    if (selected.length === 0 || this.readOnly) {
      return false;
    }
    for (const object of selected) {
      if (object.prefab === "wall") {
        const { start, end } = getWallEndpoints(object);
        setWallEndpoints(
          object,
          [
            start[0] + direction[0] * distance,
            start[1] + direction[1] * distance,
          ],
          [end[0] + direction[0] * distance, end[1] + direction[1] * distance]
        );
      } else {
        const shape = getLevelObjectShape(
          object,
          this.getDefaultWallThickness()
        );
        applyLevelObjectShape(
          object,
          moveShape(shape, [
            shape.position[0] + direction[0] * distance,
            shape.position[1] + direction[1] * distance,
          ])
        );
      }
    }
    this.callbacks.onObjectsChange(selected);
    this.callbacks.onObjectsCommit(selected);
    return true;
  };

  private readonly handleSelectionModifierChange = (held: boolean) => {
    this.endpointFeedback = null;
    if (this.lastPointerScreen) {
      this.updateIdleState(this.lastPointerScreen, {
        temporarySelection: held && this.creationToolActive,
      });
    } else {
      this.updateCursor();
    }
  };

  private readonly handleWindowBlur = () => {
    this.endpointFeedback = null;
    if (this.gesture) {
      this.cancelGesture();
    }
    this.updateCursor();
  };
}
