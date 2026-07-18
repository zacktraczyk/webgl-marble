import type { Vec2 } from "../../engine/core/transform";
import type Stage from "../../engine/stage";
import { GRID_SIZE } from "../../scenes/level-builder/constants";
import {
  snapDeltaToGrid,
  snapPointToGrid,
  type GridLayout,
} from "../../scenes/level-builder/grid";
import {
  isPusherTool,
  SelectedTool,
  type PusherTool,
} from "../../scenes/level-builder/types";
import type { LevelObjectData } from "../levelDocument";
import type {
  EditorGesture,
  PusherPlacementPreview,
  SelectionMarquee,
  TransformGesture,
  WallDraft,
  WallEndpointFeedback,
} from "./gestures";
import { LevelEditorKeyboard } from "./keyboard";
import { LevelEditorSelection } from "./selection";
import { oscillationPeriodForRange } from "../levelMotion";
import {
  applyLevelObjectShape,
  boundsIntersect,
  constrainDeltaToAxis,
  constrainPointToAngle,
  findNearestPointIndex,
  getLevelObjectBounds,
  getLevelObjectShape,
  getRotationHandle,
  getResizeAnchors,
  getWallEndpoints,
  isLevelObjectRotatable,
  isLevelObjectResizable,
  moveShape,
  pickLevelObject,
  resizeHandleCursor,
  resizeShape,
  rotateShape,
  setWallEndpoints,
  type Bounds,
  type LevelObjectShape,
  type ResizeHandle,
} from "../levelGeometry";

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
export { EditorOverlay } from "./overlay";

type WallObject = Extract<LevelObjectData, { prefab: "wall" }>;
type WallEndpointTarget = Omit<WallEndpointFeedback, "kind"> & {
  object: WallObject;
};
type WallEndpointExclusion = Pick<WallEndpointTarget, "objectId" | "endpoint">;

const SIZE_SNAP_STEP = GRID_SIZE / 5;
const ROTATION_SNAP_STEP = Math.PI / 12;
const ROTATION_HANDLE_OFFSET = 28;
const HANDLE_HIT_RADIUS = 8;
const ENDPOINT_SNAP_RADIUS = 12;
const DRAG_THRESHOLD = 3;
const MIN_OBJECT_SIZE = GRID_SIZE * 0.4;
const MIN_WALL_LENGTH = GRID_SIZE * 0.4;

const boundsFromPoints = (first: Vec2, second: Vec2): Bounds => ({
  min: [Math.min(first[0], second[0]), Math.min(first[1], second[1])],
  max: [Math.max(first[0], second[0]), Math.max(first[1], second[1])],
});

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

  private get creationToolActive() {
    return (
      this.activeTool === SelectedTool.Wall || isPusherTool(this.activeTool)
    );
  }

  private isTemporarySelection(modifier: {
    metaKey: boolean;
    ctrlKey: boolean;
  }) {
    return this.creationToolActive && (modifier.metaKey || modifier.ctrlKey);
  }

  private endpointAt(object: LevelObjectData, screenPoint: Vec2) {
    if (object.prefab !== "wall") {
      return null;
    }
    const { start, end } = getWallEndpoints(object);
    const startScreen = this.stage.camera.worldToScreen(...start);
    const endScreen = this.stage.camera.worldToScreen(...end);
    if (this.screenDistance(startScreen, screenPoint) <= HANDLE_HIT_RADIUS) {
      return "start" as const;
    }
    if (this.screenDistance(endScreen, screenPoint) <= HANDLE_HIT_RADIUS) {
      return "end" as const;
    }
    return null;
  }

  private wallEndpointTargetAt(
    screenPoint: Vec2,
    maximumDistance: number,
    {
      selectableOnly = false,
      exclude,
    }: {
      selectableOnly?: boolean;
      exclude?: WallEndpointExclusion;
    } = {}
  ): WallEndpointTarget | null {
    const candidates = this.getObjects().flatMap((object) => {
      if (object.prefab !== "wall" || (selectableOnly && object.locked)) {
        return [];
      }
      const { start, end } = getWallEndpoints(object);
      return (["start", "end"] as const)
        .filter(
          (endpoint) =>
            object.id !== exclude?.objectId || endpoint !== exclude.endpoint
        )
        .map((endpoint) => ({
          object,
          objectId: object.id,
          endpoint,
          position: endpoint === "start" ? start : end,
        }));
    });
    const nearestIndex = findNearestPointIndex(
      candidates.map((candidate) =>
        this.stage.camera.worldToScreen(...candidate.position)
      ),
      screenPoint,
      maximumDistance
    );
    return nearestIndex === null ? null : candidates[nearestIndex];
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

  private resizeHandleAt(object: LevelObjectData, screenPoint: Vec2) {
    if (!isLevelObjectResizable(object)) {
      return null;
    }
    const shape = getLevelObjectShape(object, this.getDefaultWallThickness());
    for (const anchor of getResizeAnchors(shape)) {
      const anchorScreen = this.stage.camera.worldToScreen(...anchor.position);
      if (this.screenDistance(anchorScreen, screenPoint) <= HANDLE_HIT_RADIUS) {
        return anchor.handle;
      }
    }
    return null;
  }

  private rotationHandleAt(object: LevelObjectData, screenPoint: Vec2) {
    if (!isLevelObjectRotatable(object)) {
      return false;
    }
    const offset =
      ROTATION_HANDLE_OFFSET /
      Math.max(Math.abs(this.stage.camera.zoom), 0.001);
    const handle = getRotationHandle(
      getLevelObjectShape(object, this.getDefaultWallThickness()),
      offset
    );
    return (
      this.screenDistance(
        this.stage.camera.worldToScreen(...handle.position),
        screenPoint
      ) <= HANDLE_HIT_RADIUS
    );
  }

  private motionRangeHandleAt(object: LevelObjectData, screenPoint: Vec2) {
    if (object.motion?.type !== "oscillate") {
      return false;
    }
    const center = getLevelObjectShape(
      object,
      this.getDefaultWallThickness()
    ).position;
    const handle: Vec2 = [
      center[0] + object.motion.vector[0],
      center[1] + object.motion.vector[1],
    ];
    return (
      this.screenDistance(
        this.stage.camera.worldToScreen(...handle),
        screenPoint
      ) <=
      HANDLE_HIT_RADIUS + 2
    );
  }

  private snapPlacementPoint(
    point: Vec2,
    free: boolean,
    exclude?: WallEndpointExclusion
  ) {
    if (free) {
      this.endpointFeedback = null;
      return [...point] as Vec2;
    }
    const target = this.wallEndpointTargetAt(
      this.stage.camera.worldToScreen(...point),
      ENDPOINT_SNAP_RADIUS,
      { exclude }
    );
    this.showEndpointFeedback(target, "snap");
    if (target) {
      return [...target.position] as Vec2;
    }
    return this.getGridSnapEnabled()
      ? snapPointToGrid(point, this.getGridLayout())
      : ([...point] as Vec2);
  }

  private snapWallEndpoint(
    fixed: Vec2,
    point: Vec2,
    { free, constrain }: { free: boolean; constrain: boolean },
    exclude?: WallEndpointExclusion
  ) {
    if (free) {
      this.endpointFeedback = null;
      return [...point] as Vec2;
    }
    if (constrain) {
      this.endpointFeedback = null;
      const gridStep = this.getGridLayout().step;
      return constrainPointToAngle(
        fixed,
        point,
        ROTATION_SNAP_STEP,
        this.getGridSnapEnabled() ? (gridStep[0] + gridStep[1]) / 2 : 0
      );
    }
    return this.snapPlacementPoint(point, false, exclude);
  }

  private beginPan(event: PointerEvent, screenPoint: Vec2) {
    this.gesture = {
      kind: "pan",
      pointerId: event.pointerId,
      lastScreen: screenPoint,
    };
    this.capturePointer(event.pointerId);
    this.stage.canvas.style.cursor = "grabbing";
  }

  private beginMove(event: PointerEvent, screenPoint: Vec2) {
    const originals = new Map(
      this.selectedObjects.map((object) => [object.id, structuredClone(object)])
    );
    this.gesture = {
      kind: "move",
      pointerId: event.pointerId,
      startWorld: this.worldPoint(screenPoint),
      startScreen: screenPoint,
      originals,
      changed: false,
    };
    this.capturePointer(event.pointerId);
    this.stage.canvas.style.cursor = "grabbing";
  }

  private beginTransform(
    event: PointerEvent,
    object: LevelObjectData,
    kind: TransformGesture["kind"],
    screenPoint: Vec2,
    handle?: ResizeHandle
  ) {
    this.gesture = {
      kind,
      pointerId: event.pointerId,
      objectId: object.id,
      handle,
      startShape: getLevelObjectShape(object, this.getDefaultWallThickness()),
      startWorld: this.worldPoint(screenPoint),
      startScreen: screenPoint,
      changed: false,
    };
    this.capturePointer(event.pointerId);
  }

  private readonly pointerDown = (event: PointerEvent) => {
    const screenPoint = this.screenPoint(event);
    this.lastPointerScreen = screenPoint;
    const temporaryPan = this.keyboard.spaceHeld && event.button === 0;
    if (
      event.button === 1 ||
      temporaryPan ||
      (this.activeTool === SelectedTool.Pan && event.button === 0)
    ) {
      this.beginPan(event, screenPoint);
      event.preventDefault();
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const temporarySelection = this.isTemporarySelection(event);

    if (
      this.activeTool === SelectedTool.Wall &&
      !temporarySelection &&
      !this.readOnly
    ) {
      const worldPoint = this.worldPoint(screenPoint);
      const existingAnchor = this.wallAnchor;
      const anchored = existingAnchor !== null;
      const start = existingAnchor
        ? ([...existingAnchor] as Vec2)
        : this.snapPlacementPoint(worldPoint, event.altKey);
      const end = anchored
        ? this.snapWallEndpoint(start, worldPoint, {
            free: event.altKey,
            constrain: event.shiftKey,
          })
        : ([...start] as Vec2);
      this.gesture = {
        kind: "wall",
        pointerId: event.pointerId,
        start,
        end,
        startScreen: screenPoint,
        anchored,
        changed: false,
      };
      this.capturePointer(event.pointerId);
      event.preventDefault();
      return;
    }

    if (
      isPusherTool(this.activeTool) &&
      !temporarySelection &&
      !this.readOnly
    ) {
      this.gesture = {
        kind: "place",
        pointerId: event.pointerId,
        tool: this.activeTool,
        startScreen: screenPoint,
      };
      this.capturePointer(event.pointerId);
      event.preventDefault();
      return;
    }

    if (this.activeTool !== SelectedTool.Pointer && !temporarySelection) {
      return;
    }

    const selectedObject = this.selectedObject;
    if (
      selectedObject &&
      this.motionRangeHandleAt(selectedObject, screenPoint) &&
      !this.readOnly
    ) {
      if (!selectedObject.motion) {
        return;
      }
      this.gesture = {
        kind: "motion-range",
        pointerId: event.pointerId,
        objectId: selectedObject.id,
        startMotion: structuredClone(selectedObject.motion),
        startScreen: screenPoint,
        changed: false,
      };
      this.capturePointer(event.pointerId);
      event.preventDefault();
      return;
    }
    const directEndpointTarget = temporarySelection
      ? this.wallEndpointTargetAt(screenPoint, HANDLE_HIT_RADIUS, {
          selectableOnly: true,
        })
      : null;
    const endpointObject =
      directEndpointTarget?.object ??
      (selectedObject?.prefab === "wall" ? selectedObject : null);
    const endpoint =
      directEndpointTarget?.endpoint ??
      (endpointObject ? this.endpointAt(endpointObject, screenPoint) : null);
    if (endpointObject && endpoint && !this.readOnly) {
      if (directEndpointTarget) {
        this.selection.replace(endpointObject.id);
      }
      const { start, end } = getWallEndpoints(endpointObject);
      this.gesture = {
        kind: "wall-endpoint",
        pointerId: event.pointerId,
        objectId: endpointObject.id,
        endpoint,
        start,
        end,
        startScreen: screenPoint,
        changed: false,
      };
      this.showEndpointFeedback(directEndpointTarget, "edit");
      this.capturePointer(event.pointerId);
      event.preventDefault();
      return;
    }

    const isRotationHandle = selectedObject
      ? this.rotationHandleAt(selectedObject, screenPoint)
      : false;
    const resizeHandle = selectedObject
      ? this.resizeHandleAt(selectedObject, screenPoint)
      : null;
    if (selectedObject && isRotationHandle && !this.readOnly) {
      this.beginTransform(event, selectedObject, "rotate", screenPoint);
      event.preventDefault();
      return;
    }
    if (selectedObject && resizeHandle && !this.readOnly) {
      this.beginTransform(
        event,
        selectedObject,
        "resize",
        screenPoint,
        resizeHandle
      );
      event.preventDefault();
      return;
    }

    const pickedObject = pickLevelObject(
      this.getObjects(),
      this.worldPoint(screenPoint),
      4 / Math.max(this.stage.camera.zoom, 0.001),
      this.getDefaultWallThickness()
    );
    if (pickedObject) {
      if (event.shiftKey) {
        if (this.selection.has(pickedObject.id)) {
          this.selection.delete(pickedObject.id);
          this.updateIdleState(screenPoint);
          event.preventDefault();
          return;
        }
        this.selection.add(pickedObject.id);
      } else if (!this.selection.has(pickedObject.id)) {
        this.selection.replace(pickedObject.id);
      }
      this.selection.setHovered(pickedObject.id);
      if (!this.readOnly) {
        this.beginMove(event, screenPoint);
      }
      event.preventDefault();
      return;
    }

    const initialSelection = this.selection.snapshot();
    if (!event.shiftKey) {
      this.selection.clear();
    }
    const worldPoint = this.worldPoint(screenPoint);
    this.gesture = {
      kind: "marquee",
      pointerId: event.pointerId,
      startWorld: worldPoint,
      currentWorld: worldPoint,
      startScreen: screenPoint,
      additive: event.shiftKey,
      initialSelection,
      changed: false,
    };
    this.capturePointer(event.pointerId);
    event.preventDefault();
  };

  private readonly pointerMove = (event: PointerEvent) => {
    const screenPoint = this.screenPoint(event);
    this.lastPointerScreen = screenPoint;
    if (!this.gesture) {
      const temporarySelection = this.isTemporarySelection(event);
      if (
        this.activeTool === SelectedTool.Wall &&
        this.wallAnchor &&
        !temporarySelection &&
        !this.readOnly
      ) {
        this.wallPreviewEnd = this.snapWallEndpoint(
          this.wallAnchor,
          this.worldPoint(screenPoint),
          {
            free: event.altKey,
            constrain: event.shiftKey,
          }
        );
      } else if (
        this.creationToolActive &&
        !temporarySelection &&
        !this.readOnly
      ) {
        const position = this.snapPlacementPoint(
          this.worldPoint(screenPoint),
          event.altKey
        );
        this.placementPreviewPosition = isPusherTool(this.activeTool)
          ? position
          : null;
      } else if (temporarySelection) {
        this.endpointFeedback = null;
        this.placementPreviewPosition = null;
      }
      this.updateIdleState(screenPoint, {
        temporarySelection,
      });
      return;
    }

    if (event.pointerId !== this.gesture.pointerId) {
      return;
    }

    if (this.gesture.kind === "pan") {
      this.cameraControls.panByScreen(
        screenPoint[0] - this.gesture.lastScreen[0],
        screenPoint[1] - this.gesture.lastScreen[1]
      );
      this.gesture.lastScreen = screenPoint;
      event.preventDefault();
      return;
    }

    const worldPoint = this.worldPoint(screenPoint);
    if (this.gesture.kind === "motion-range") {
      if (
        !this.gesture.changed &&
        this.screenDistance(screenPoint, this.gesture.startScreen) <
          DRAG_THRESHOLD
      ) {
        return;
      }
      const object = this.findObject(this.gesture.objectId);
      if (!object || object.motion?.type !== "oscillate") {
        this.cancelGesture();
        return;
      }
      const center = getLevelObjectShape(
        object,
        this.getDefaultWallThickness()
      ).position;
      let vector: Vec2 = [worldPoint[0] - center[0], worldPoint[1] - center[1]];
      if (event.shiftKey) {
        vector = constrainDeltaToAxis(vector);
      }
      if (!event.altKey && this.getGridSnapEnabled()) {
        vector = snapDeltaToGrid(vector, this.getGridLayout());
      }
      if (Math.hypot(...vector) >= MIN_OBJECT_SIZE) {
        object.motion.periodMs = oscillationPeriodForRange(
          object.motion,
          Math.hypot(...vector)
        );
        object.motion.vector = vector;
        this.gesture.changed = true;
        this.callbacks.onObjectsChange([object]);
      }
      event.preventDefault();
      return;
    }

    if (this.gesture.kind === "wall") {
      this.gesture.end = this.snapWallEndpoint(this.gesture.start, worldPoint, {
        free: event.altKey,
        constrain: event.shiftKey,
      });
      this.gesture.changed =
        this.screenDistance(screenPoint, this.gesture.startScreen) >=
        DRAG_THRESHOLD;
      event.preventDefault();
      return;
    }

    if (this.gesture.kind === "place") {
      event.preventDefault();
      return;
    }

    if (this.gesture.kind === "marquee") {
      this.gesture.currentWorld = worldPoint;
      this.gesture.changed =
        this.screenDistance(screenPoint, this.gesture.startScreen) >=
        DRAG_THRESHOLD;
      if (this.gesture.changed) {
        const selectionBounds = boundsFromPoints(
          this.gesture.startWorld,
          this.gesture.currentWorld
        );
        const nextSelection = this.gesture.additive
          ? new Set(this.gesture.initialSelection)
          : new Set<string>();
        for (const object of this.getObjects()) {
          if (
            !object.locked &&
            boundsIntersect(
              selectionBounds,
              getLevelObjectBounds(object, this.getDefaultWallThickness())
            )
          ) {
            nextSelection.add(object.id);
          }
        }
        this.selection.replaceAll(nextSelection);
      }
      event.preventDefault();
      return;
    }

    if (this.gesture.kind === "move") {
      if (
        !this.gesture.changed &&
        this.screenDistance(screenPoint, this.gesture.startScreen) <
          DRAG_THRESHOLD
      ) {
        return;
      }
      this.gesture.changed = true;
      let rawDelta: Vec2 = [
        worldPoint[0] - this.gesture.startWorld[0],
        worldPoint[1] - this.gesture.startWorld[1],
      ];
      if (event.shiftKey) {
        rawDelta = constrainDeltaToAxis(rawDelta);
      }
      const delta =
        event.altKey || !this.getGridSnapEnabled()
          ? rawDelta
          : snapDeltaToGrid(rawDelta, this.getGridLayout());
      const changed: LevelObjectData[] = [];
      for (const [id, original] of this.gesture.originals) {
        const object = this.findObject(id);
        if (!object) {
          continue;
        }
        if (object.prefab === "wall" && original.prefab === "wall") {
          setWallEndpoints(
            object,
            [
              original.properties.start[0] + delta[0],
              original.properties.start[1] + delta[1],
            ],
            [
              original.properties.end[0] + delta[0],
              original.properties.end[1] + delta[1],
            ]
          );
        } else {
          const originalShape = getLevelObjectShape(
            original,
            this.getDefaultWallThickness()
          );
          applyLevelObjectShape(
            object,
            moveShape(originalShape, [
              originalShape.position[0] + delta[0],
              originalShape.position[1] + delta[1],
            ])
          );
        }
        changed.push(object);
      }
      this.callbacks.onObjectsChange(changed);
      event.preventDefault();
      return;
    }

    if (this.gesture.kind === "wall-endpoint") {
      if (
        !this.gesture.changed &&
        this.screenDistance(screenPoint, this.gesture.startScreen) <
          DRAG_THRESHOLD
      ) {
        return;
      }
      const object = this.findObject(this.gesture.objectId);
      if (!object || object.prefab !== "wall") {
        this.cancelGesture();
        return;
      }
      this.gesture.changed = true;
      const fixed =
        this.gesture.endpoint === "start"
          ? this.gesture.end
          : this.gesture.start;
      const endpoint = this.snapWallEndpoint(
        fixed,
        worldPoint,
        {
          free: event.altKey,
          constrain: event.shiftKey,
        },
        {
          objectId: this.gesture.objectId,
          endpoint: this.gesture.endpoint,
        }
      );
      setWallEndpoints(
        object,
        this.gesture.endpoint === "start" ? endpoint : this.gesture.start,
        this.gesture.endpoint === "end" ? endpoint : this.gesture.end
      );
      this.callbacks.onObjectsChange([object]);
      event.preventDefault();
      return;
    }

    if (
      !this.gesture.changed &&
      this.screenDistance(screenPoint, this.gesture.startScreen) <
        DRAG_THRESHOLD
    ) {
      return;
    }
    const object = this.findObject(this.gesture.objectId);
    if (!object) {
      this.cancelGesture();
      return;
    }
    this.gesture.changed = true;
    let nextShape: LevelObjectShape;
    if (this.gesture.kind === "resize") {
      if (!this.gesture.handle) {
        return;
      }
      nextShape = resizeShape(
        this.gesture.startShape,
        this.gesture.handle,
        worldPoint,
        event.altKey ? 0 : SIZE_SNAP_STEP,
        MIN_OBJECT_SIZE
      );
    } else {
      const center = this.gesture.startShape.position;
      const startAngle = Math.atan2(
        this.gesture.startWorld[1] - center[1],
        this.gesture.startWorld[0] - center[0]
      );
      const currentAngle = Math.atan2(
        worldPoint[1] - center[1],
        worldPoint[0] - center[0]
      );
      const angleDelta = Math.atan2(
        Math.sin(currentAngle - startAngle),
        Math.cos(currentAngle - startAngle)
      );
      nextShape = rotateShape(
        this.gesture.startShape,
        this.gesture.startShape.rotation + angleDelta,
        event.altKey ? 0 : ROTATION_SNAP_STEP
      );
    }
    applyLevelObjectShape(object, nextShape);
    this.callbacks.onObjectsChange([object]);
    event.preventDefault();
  };

  private readonly pointerUp = (event: PointerEvent) => {
    if (!this.gesture || event.pointerId !== this.gesture.pointerId) {
      return;
    }
    const gesture = this.gesture;
    const screenPoint = this.screenPoint(event);
    this.lastPointerScreen = screenPoint;
    this.gesture = null;
    this.releasePointer(event.pointerId);

    if (gesture.kind === "wall") {
      const length = Math.hypot(
        gesture.end[0] - gesture.start[0],
        gesture.end[1] - gesture.start[1]
      );
      if ((gesture.changed || gesture.anchored) && length >= MIN_WALL_LENGTH) {
        const object = this.callbacks.onCreateWall(gesture.start, gesture.end);
        this.selection.replace(object.id);
        if (gesture.anchored) {
          this.wallAnchor = [...gesture.end];
          this.wallPreviewEnd = [...gesture.end];
        } else {
          this.clearWallAnchor();
        }
        this.callbacks.onToolComplete(SelectedTool.Wall);
      } else if (!gesture.anchored) {
        this.wallAnchor = [...gesture.start];
        this.wallPreviewEnd = [...gesture.start];
      } else {
        this.wallPreviewEnd = [...gesture.end];
      }
    } else if (gesture.kind === "place") {
      if (this.screenDistance(screenPoint, gesture.startScreen) < 8) {
        const position = this.snapPlacementPoint(
          this.worldPoint(screenPoint),
          event.altKey
        );
        const object = this.callbacks.onPlaceObject(gesture.tool, position);
        this.selection.replace(object.id);
        this.placementPreviewPosition = null;
        this.callbacks.onToolComplete(gesture.tool);
      }
    } else if (
      (gesture.kind === "move" ||
        gesture.kind === "resize" ||
        gesture.kind === "rotate" ||
        gesture.kind === "wall-endpoint" ||
        gesture.kind === "motion-range") &&
      gesture.changed
    ) {
      this.callbacks.onObjectsCommit(this.selectedObjects);
    }

    this.updateIdleState(screenPoint, {
      temporarySelection: this.isTemporarySelection(event),
    });
    event.preventDefault();
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

  private updateIdleState(
    screenPoint: Vec2,
    {
      temporarySelection = this.keyboard.selectionModifierHeld &&
        this.creationToolActive,
    }: { temporarySelection?: boolean } = {}
  ) {
    if (this.gesture) {
      return;
    }
    if (this.keyboard.spaceHeld || this.activeTool === SelectedTool.Pan) {
      this.selection.setHovered(null);
      this.stage.canvas.style.cursor = "grab";
      return;
    }
    if (this.creationToolActive && !temporarySelection) {
      this.selection.setHovered(null);
      this.stage.canvas.style.cursor = this.readOnly
        ? "not-allowed"
        : "crosshair";
      return;
    }

    const directEndpointTarget = temporarySelection
      ? this.wallEndpointTargetAt(screenPoint, HANDLE_HIT_RADIUS, {
          selectableOnly: true,
        })
      : null;
    if (directEndpointTarget) {
      this.selection.setHovered(directEndpointTarget.objectId);
      this.showEndpointFeedback(directEndpointTarget, "edit");
      this.stage.canvas.style.cursor = this.readOnly ? "default" : "crosshair";
      return;
    }

    this.endpointFeedback = null;
    const selectedObject = this.selectedObject;
    if (
      selectedObject &&
      this.motionRangeHandleAt(selectedObject, screenPoint)
    ) {
      this.selection.setHovered(selectedObject.id);
      this.stage.canvas.style.cursor = this.readOnly ? "default" : "crosshair";
      return;
    }
    const selectedEndpoint = selectedObject
      ? this.endpointAt(selectedObject, screenPoint)
      : null;
    if (selectedObject?.prefab === "wall" && selectedEndpoint) {
      const { start, end } = getWallEndpoints(selectedObject);
      this.selection.setHovered(selectedObject.id);
      this.showEndpointFeedback(
        {
          object: selectedObject,
          objectId: selectedObject.id,
          endpoint: selectedEndpoint,
          position: selectedEndpoint === "start" ? start : end,
        },
        "edit"
      );
      this.stage.canvas.style.cursor = this.readOnly ? "default" : "crosshair";
      return;
    }
    if (selectedObject && this.rotationHandleAt(selectedObject, screenPoint)) {
      this.selection.setHovered(selectedObject.id);
      this.stage.canvas.style.cursor = this.readOnly ? "default" : "grab";
      return;
    }
    const handle = selectedObject
      ? this.resizeHandleAt(selectedObject, screenPoint)
      : null;
    if (handle) {
      this.selection.setHovered(selectedObject?.id ?? null);
      this.stage.canvas.style.cursor = this.readOnly
        ? "default"
        : resizeHandleCursor(handle);
      return;
    }
    const hoveredObject = pickLevelObject(
      this.getObjects(),
      this.worldPoint(screenPoint),
      4 / Math.max(this.stage.camera.zoom, 0.001),
      this.getDefaultWallThickness()
    );
    this.selection.setHovered(hoveredObject?.id ?? null);
    this.stage.canvas.style.cursor =
      hoveredObject && !this.readOnly ? "grab" : "default";
  }

  private updateCursor() {
    if (this.gesture?.kind === "pan") {
      this.stage.canvas.style.cursor = "grabbing";
    } else if (
      this.keyboard.spaceHeld ||
      this.activeTool === SelectedTool.Pan
    ) {
      this.stage.canvas.style.cursor = "grab";
    } else if (this.keyboard.selectionModifierHeld && this.creationToolActive) {
      this.stage.canvas.style.cursor = "default";
    } else if (this.creationToolActive) {
      this.stage.canvas.style.cursor = this.readOnly
        ? "not-allowed"
        : "crosshair";
    } else {
      this.stage.canvas.style.cursor = "default";
    }
  }

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
