import type { Vec2 } from "../../engine/core/transform";
import type Stage from "../../engine/stage";
import type { GridLayout } from "../../game/level/grid";
import {
  isCreationTool,
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
  findWallEndpointTarget,
  type HandleTestDeps,
  type WallEndpointTarget,
} from "./handles";
import {
  updateCursor as applyIdleCursor,
  updateIdleState as applyIdleState,
  type IdleCursorContext,
} from "./idleCursor";
import { LegEditorKeyboard } from "./keyboard";
import {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  type PointerGestureHost,
} from "./pointerGestures";
import { LegEditorSelection } from "./selection";
import {
  alignSelectedObjects,
  copySelectedObjects,
  cutSelectedObjects,
  deleteSelectedObjects,
  distributeSelectedObjects,
  duplicateSelectedObjects,
  finishWallDraft,
  focusSelectedObjects,
  handleEscapeKey,
  hasClipboardObjects,
  mirrorCopySelectedObjects,
  mirrorSelectedObjects,
  nudgeSelectedObjects,
  pasteClipboardObjects,
  selectAllObjects,
  type SelectionActionHost,
} from "./selectionActions";
import { type SnapDeps } from "./snap";
import {
  applyLevelObjectShape,
  getLevelObjectShape,
  setWallEndpoints,
  type LevelObjectShape,
} from "../../game/level/geometry";
import { pickLevelObject, pickTolerance } from "../geometry";
import type {
  SelectionAlignment,
  SelectionDistribution,
  SelectionMirror,
} from "./selectionTransforms";

type EditorCallbacks = {
  onObjectsChange(objects: readonly LevelObjectData[]): void;
  onObjectsCommit(objects: readonly LevelObjectData[]): void;
  onDelete(objects: readonly LevelObjectData[]): void;
  onInsert(objects: readonly LevelObjectData[]): LevelObjectData[];
  onDiscard(objects: readonly LevelObjectData[]): void;
  onCreateWall(start: Vec2, end: Vec2): LevelObjectData;
  onPlaceObject(tool: PusherTool, position: Vec2): LevelObjectData;
  onToolRequest(tool: SelectedTool): void;
  onToolComplete(tool: SelectedTool): void;
  onUndo(): void;
  onRedo(): void;
  onReset(): void;
  onFocus(objects: readonly LevelObjectData[]): void;
};

export type EditorContextAction =
  | "duplicate"
  | "cut"
  | "copy"
  | "paste"
  | "paste-in-place"
  | "select-all"
  | "focus"
  | "delete"
  | `align-${SelectionAlignment}`
  | `distribute-${SelectionDistribution}`
  | `flip-${SelectionMirror}`
  | `mirror-${SelectionMirror}`;

export type EditorContextState = {
  selectionCount: number;
  copyableSelectionCount: number;
  canPaste: boolean;
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
export type { WallEndpointExclusion, WallEndpointTarget } from "./handles";
export { EditorOverlay } from "./overlay";

export class LegEditorController {
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
  private readonly keyboard: LegEditorKeyboard;
  private lastPointerScreen: Vec2 | null = null;
  private readonly selection: LegEditorSelection;
  private wallAnchor: Vec2 | null = null;
  private wallPreviewEnd: Vec2 | null = null;
  private endpointFeedback: WallEndpointFeedback | null = null;
  private placementPreviewPosition: Vec2 | null = null;
  private repeatDuplicateDelta: Vec2 | null = null;
  /** Persistent hosts shared with gesture/selection modules — created once. */
  private readonly selectionHost: SelectionActionHost;
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
    this.selection = new LegEditorSelection(getObjects);
    this.selectionHost = this.createSelectionActionHost();

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
    this.keyboard = new LegEditorKeyboard(
      {
        undo: () => {
          this.cancelGesture();
          this.callbacks.onUndo();
        },
        redo: () => {
          this.cancelGesture();
          this.callbacks.onRedo();
        },
        copy: this.copySelection,
        cut: this.cutSelection,
        paste: (inPlace) => this.pasteSelection({ inPlace }),
        duplicate: this.duplicateSelection,
        focusSelection: this.focusSelection,
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
    this.gestureHost = this.createGestureHost();
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

  get selectionCount() {
    return this.selection.size;
  }

  prepareContextMenu(screenPoint: Vec2): EditorContextState {
    if (!this.readOnly) {
      const picked = pickLevelObject(
        this.getObjects(),
        this.worldPoint(screenPoint),
        pickTolerance(this.cameraZoom),
        this.getDefaultWallThickness()
      );
      if (picked && !this.selection.has(picked.id)) {
        this.selection.replace(picked.id);
      } else if (!picked) {
        this.selection.clear();
      }
    }
    return {
      selectionCount: this.selection.size,
      copyableSelectionCount: this.selectedObjects.filter(
        (object) => object.prefab !== "spawn-point"
      ).length,
      canPaste: !this.readOnly && hasClipboardObjects(),
    };
  }

  performContextAction(action: EditorContextAction, screenPoint?: Vec2) {
    if (action.startsWith("align-")) {
      return this.alignSelection(action.slice(6) as SelectionAlignment);
    }
    if (action.startsWith("distribute-")) {
      return this.distributeSelection(
        action.slice(11) as SelectionDistribution
      );
    }
    if (action.startsWith("mirror-")) {
      return this.mirrorCopySelection(action.slice(7) as SelectionMirror);
    }
    if (action.startsWith("flip-")) {
      return mirrorSelectedObjects(
        this.selectionHost,
        action.slice(5) as SelectionMirror
      );
    }
    switch (action) {
      case "duplicate":
        return this.duplicateSelection();
      case "cut":
        return this.cutSelection();
      case "copy":
        return this.copySelection();
      case "paste":
        return this.pasteSelection(
          screenPoint ? { at: this.worldPoint(screenPoint) } : undefined
        );
      case "paste-in-place":
        return this.pasteSelection({ inPlace: true });
      case "select-all":
        return this.selectAll();
      case "focus":
        return this.focusSelection();
      case "delete":
        return this.deleteSelection();
    }
  }

  alignSelection(alignment: SelectionAlignment) {
    return alignSelectedObjects(this.selectionHost, alignment);
  }

  distributeSelection(distribution: SelectionDistribution) {
    return distributeSelectedObjects(this.selectionHost, distribution);
  }

  mirrorCopySelection(mirror: SelectionMirror) {
    return mirrorCopySelectedObjects(this.selectionHost, mirror);
  }

  updateSelectedShape(shape: LevelObjectShape, wallThickness?: number) {
    const object = this.selectedObject;
    if (!object || this.readOnly) {
      return false;
    }
    applyLevelObjectShape(object, shape);
    if (object.prefab === "wall" && wallThickness !== undefined) {
      object.properties.thickness = wallThickness;
    }
    this.callbacks.onObjectsChange([object]);
    this.callbacks.onObjectsCommit([object]);
    return true;
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
    return isCreationTool(this.activeTool);
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
      if (gesture.inserted) {
        const inserted = [...gesture.originals.keys()]
          .map((id) => this.findObject(id))
          .filter((object): object is LevelObjectData => Boolean(object));
        this.callbacks.onDiscard(inserted);
        this.selection.replaceAll(gesture.sourceSelection);
        return;
      }
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

    if (gesture.kind === "move" && gesture.inserted) {
      const inserted = [...gesture.originals.keys()]
        .map((id) => this.findObject(id))
        .filter((object): object is LevelObjectData => Boolean(object));
      this.callbacks.onDiscard(inserted);
      this.selection.replaceAll(gesture.sourceSelection);
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
    const gesture = this.gesture;
    handlePointerUp(this.gestureHost, event);
    if (gesture?.kind === "move" && gesture.inserted && gesture.changed) {
      const firstEntry = gesture.originals.entries().next().value;
      if (firstEntry) {
        const [id, original] = firstEntry;
        const object = this.findObject(id);
        if (object) {
          const before = getLevelObjectShape(
            original,
            this.getDefaultWallThickness()
          ).position;
          const after = getLevelObjectShape(
            object,
            this.getDefaultWallThickness()
          ).position;
          this.repeatDuplicateDelta = [
            after[0] - before[0],
            after[1] - before[1],
          ];
        }
      }
    }
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

  private readonly selectAll = () => selectAllObjects(this.selectionHost);

  private readonly copySelection = () =>
    copySelectedObjects(this.selectionHost);

  private readonly cutSelection = () => cutSelectedObjects(this.selectionHost);

  private readonly pasteSelection = (options?: {
    inPlace?: boolean;
    at?: Vec2;
  }) => pasteClipboardObjects(this.selectionHost, options);

  private readonly duplicateSelection = () => {
    const delta = this.repeatDuplicateDelta ?? [...this.getGridLayout().step];
    const duplicated = duplicateSelectedObjects(this.selectionHost, delta);
    if (duplicated) {
      this.repeatDuplicateDelta = [...delta];
    }
    return duplicated;
  };

  private readonly focusSelection = () =>
    focusSelectedObjects(this.selectionHost);

  private readonly handleEscape = () => handleEscapeKey(this.selectionHost);

  private readonly finishWall = () => finishWallDraft(this.selectionHost);

  private readonly deleteSelection = () =>
    deleteSelectedObjects(this.selectionHost);

  private readonly nudgeSelection = (direction: Vec2, distance: number) =>
    nudgeSelectedObjects(this.selectionHost, direction, distance);

  /** Live facade so private controller state stays encapsulated. */
  private createSelectionActionHost(): SelectionActionHost {
    // Object-literal getters rebind `this`; keep a lexical controller ref.
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- host facade
    const controller = this;
    return {
      get readOnly() {
        return controller.readOnly;
      },
      get selection() {
        return controller.selection;
      },
      get activeTool() {
        return controller.activeTool;
      },
      get callbacks() {
        return controller.callbacks;
      },
      get selectedObjects() {
        return controller.selectedObjects;
      },
      getObjects: () => controller.getObjects(),
      getDefaultWallThickness: () => controller.getDefaultWallThickness(),
      getGridLayout: () => controller.getGridLayout(),
      get gesture() {
        return controller.gesture;
      },
      set gesture(value) {
        controller.gesture = value;
      },
      get wallAnchor() {
        return controller.wallAnchor;
      },
      set wallAnchor(value) {
        controller.wallAnchor = value;
      },
      cancelGesture: () => controller.cancelGesture(),
      clearWallAnchor: () => controller.clearWallAnchor(),
      clearSelection: () => controller.clearSelection(),
      updateCursor: () => controller.updateCursor(),
    };
  }

  /** Live-getter host bound to the controller — created once, reused per event. */
  private createGestureHost(): PointerGestureHost {
    // Object-literal getters rebind `this`; keep a lexical controller ref.
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- host facade
    const controller = this;
    return {
      get gesture() {
        return controller.gesture;
      },
      set gesture(value) {
        controller.gesture = value;
      },
      get wallAnchor() {
        return controller.wallAnchor;
      },
      set wallAnchor(value) {
        controller.wallAnchor = value;
      },
      get wallPreviewEnd() {
        return controller.wallPreviewEnd;
      },
      set wallPreviewEnd(value) {
        controller.wallPreviewEnd = value;
      },
      get endpointFeedback() {
        return controller.endpointFeedback;
      },
      set endpointFeedback(value) {
        controller.endpointFeedback = value;
      },
      get placementPreviewPosition() {
        return controller.placementPreviewPosition;
      },
      set placementPreviewPosition(value) {
        controller.placementPreviewPosition = value;
      },
      get lastPointerScreen() {
        return controller.lastPointerScreen;
      },
      set lastPointerScreen(value) {
        controller.lastPointerScreen = value;
      },
      get activeTool() {
        return controller.activeTool;
      },
      get readOnly() {
        return controller.readOnly;
      },
      get handleDeps() {
        return controller.handleDeps;
      },
      get snapDeps() {
        return controller.snapDeps;
      },
      get dragDeps() {
        return controller.dragDeps;
      },
      get selection() {
        return controller.selection;
      },
      get callbacks() {
        return controller.callbacks;
      },
      get cameraControls() {
        return controller.cameraControls;
      },
      get keyboard() {
        return controller.keyboard;
      },
      get creationToolActive() {
        return controller.creationToolActive;
      },
      get selectedObject() {
        return controller.selectedObject;
      },
      get selectedObjects() {
        return controller.selectedObjects;
      },
      get cameraZoom() {
        return controller.cameraZoom;
      },
      screenPoint: (event) => controller.screenPoint(event),
      worldPoint: (screenPoint) => controller.worldPoint(screenPoint),
      screenDistance: (first, second) =>
        controller.screenDistance(first, second),
      capturePointer: (pointerId) => controller.capturePointer(pointerId),
      releasePointer: (pointerId) => controller.releasePointer(pointerId),
      cancelGesture: () => controller.cancelGesture(),
      updateIdleState: (screenPoint, options) =>
        controller.updateIdleState(screenPoint, options),
      showEndpointFeedback: (target, kind) =>
        controller.showEndpointFeedback(target, kind),
      isTemporarySelection: (modifier) =>
        controller.isTemporarySelection(modifier),
      clearWallAnchor: () => controller.clearWallAnchor(),
      getObjects: () => controller.getObjects(),
      getDefaultWallThickness: () => controller.getDefaultWallThickness(),
      setCursor: (cursor) => controller.setCursor(cursor),
    };
  }

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
