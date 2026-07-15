import type { Vec2 } from "../engine/core/transform";
import type Stage from "../engine/stage";
import { GRID_SIZE } from "../scenes/level-builder/constants";
import { SelectedTool, type PusherTool } from "../scenes/level-builder/types";
import type { LevelObjectData, LevelObjectMotion } from "./levelDocument";
import { oscillationPeriodForRange } from "./levelMotion";
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
  snapPoint,
  type Bounds,
  type LevelObjectShape,
  type ResizeHandle,
} from "./levelGeometry";

type EditorCallbacks = {
  onObjectsChange(objects: readonly LevelObjectData[]): void;
  onObjectsCommit(objects: readonly LevelObjectData[]): void;
  onDelete(objects: readonly LevelObjectData[]): void;
  onCreateWall(start: Vec2, end: Vec2): LevelObjectData;
  onPlaceObject(
    tool: SelectedTool.SpawnPoint | PusherTool,
    position: Vec2
  ): LevelObjectData;
  onToolRequest(tool: SelectedTool): void;
  onToolComplete(tool: SelectedTool): void;
  onUndo(): void;
  onRedo(): void;
  onReset(): void;
};

type PanGesture = {
  kind: "pan";
  pointerId: number;
  lastScreen: Vec2;
};

type MoveGesture = {
  kind: "move";
  pointerId: number;
  startWorld: Vec2;
  startScreen: Vec2;
  originals: Map<string, LevelObjectData>;
  changed: boolean;
};

type TransformGesture = {
  kind: "resize" | "rotate";
  pointerId: number;
  objectId: string;
  handle?: ResizeHandle;
  startShape: LevelObjectShape;
  startWorld: Vec2;
  startScreen: Vec2;
  changed: boolean;
};

type WallEndpointGesture = {
  kind: "wall-endpoint";
  pointerId: number;
  objectId: string;
  endpoint: "start" | "end";
  start: Vec2;
  end: Vec2;
  startScreen: Vec2;
  changed: boolean;
};

type WallGesture = {
  kind: "wall";
  pointerId: number;
  start: Vec2;
  end: Vec2;
  startScreen: Vec2;
  anchored: boolean;
  changed: boolean;
};

type PlaceGesture = {
  kind: "place";
  pointerId: number;
  tool: SelectedTool.SpawnPoint | PusherTool;
  startScreen: Vec2;
};

type MotionRangeGesture = {
  kind: "motion-range";
  pointerId: number;
  objectId: string;
  startMotion: LevelObjectMotion;
  startScreen: Vec2;
  changed: boolean;
};

type MarqueeGesture = {
  kind: "marquee";
  pointerId: number;
  startWorld: Vec2;
  currentWorld: Vec2;
  startScreen: Vec2;
  additive: boolean;
  initialSelection: Set<string>;
  changed: boolean;
};

type EditorGesture =
  | PanGesture
  | MoveGesture
  | TransformGesture
  | WallEndpointGesture
  | WallGesture
  | PlaceGesture
  | MotionRangeGesture
  | MarqueeGesture;

export type WallDraft = { start: Vec2; end: Vec2; thickness: number };
export type SelectionMarquee = { start: Vec2; end: Vec2 };
export type WallEndpointFeedback = {
  objectId: string;
  endpoint: "start" | "end";
  position: Vec2;
  kind: "snap" | "edit";
};
export type PusherPlacementPreview = { tool: PusherTool; position: Vec2 };

type WallObject = Extract<LevelObjectData, { prefab: "wall" }>;
type WallEndpointTarget = Omit<WallEndpointFeedback, "kind"> & {
  object: WallObject;
};
type WallEndpointExclusion = Pick<WallEndpointTarget, "objectId" | "endpoint">;

const POSITION_SNAP_STEP = GRID_SIZE;
const SIZE_SNAP_STEP = GRID_SIZE / 5;
const ROTATION_SNAP_STEP = Math.PI / 12;
const ROTATION_HANDLE_OFFSET = 28;
const HANDLE_HIT_RADIUS = 8;
const ENDPOINT_SNAP_RADIUS = 12;
const DRAG_THRESHOLD = 3;
const MIN_OBJECT_SIZE = GRID_SIZE * 0.4;
const MIN_WALL_LENGTH = GRID_SIZE * 0.4;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

const isPusherTool = (tool: SelectedTool): tool is PusherTool =>
  tool === SelectedTool.Slider ||
  tool === SelectedTool.Spinner ||
  tool === SelectedTool.Sweeper;

const isKeyboardControlTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.matches(
      'button, a[href], input, textarea, select, summary, [role="button"], [role="menuitem"]'
    ));

const boundsFromPoints = (first: Vec2, second: Vec2): Bounds => ({
  min: [Math.min(first[0], second[0]), Math.min(first[1], second[1])],
  max: [Math.max(first[0], second[0]), Math.max(first[1], second[1])],
});

export class LevelEditorController {
  private readonly stage: Stage;
  private readonly getObjects: () => readonly LevelObjectData[];
  private readonly getDefaultWallThickness: () => number;
  private readonly getGridSnapEnabled: () => boolean;
  private readonly callbacks: EditorCallbacks;
  private gesture: EditorGesture | null = null;
  private activeTool = SelectedTool.Pointer;
  private readOnly = false;
  private spaceHeld = false;
  private selectionModifierHeld = false;
  private lastPointerScreen: Vec2 | null = null;
  private readonly selectedIds = new Set<string>();
  private hoveredId: string | null = null;
  private wallAnchor: Vec2 | null = null;
  private wallPreviewEnd: Vec2 | null = null;
  private endpointFeedback: WallEndpointFeedback | null = null;
  private placementPreviewPosition: Vec2 | null = null;

  constructor({
    stage,
    getObjects,
    getDefaultWallThickness,
    getGridSnapEnabled,
    callbacks,
    signal,
  }: {
    stage: Stage;
    getObjects: () => readonly LevelObjectData[];
    getDefaultWallThickness: () => number;
    getGridSnapEnabled: () => boolean;
    callbacks: EditorCallbacks;
    signal: AbortSignal;
  }) {
    this.stage = stage;
    this.getObjects = getObjects;
    this.getDefaultWallThickness = getDefaultWallThickness;
    this.getGridSnapEnabled = getGridSnapEnabled;
    this.callbacks = callbacks;

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
    window.addEventListener("keydown", this.keyDown, { signal });
    window.addEventListener("keyup", this.keyUp, { signal });
    window.addEventListener("blur", this.windowBlur, { signal });
  }

  setActiveTool(tool: SelectedTool) {
    if (this.activeTool !== tool) {
      this.cancelGesture();
      this.clearWallAnchor();
    }
    this.activeTool = tool;
    this.hoveredId = null;
    this.endpointFeedback = null;
    this.placementPreviewPosition = null;
    this.updateCursor();
  }

  setReadOnly(readOnly: boolean) {
    if (readOnly && !this.readOnly) {
      this.cancelGesture();
      this.clearWallAnchor();
      this.hoveredId = null;
      this.endpointFeedback = null;
      this.placementPreviewPosition = null;
    }
    this.readOnly = readOnly;
    this.updateCursor();
  }

  clearSelection() {
    this.selectedIds.clear();
    this.hoveredId = null;
  }

  get isActive() {
    return (
      this.activeTool === SelectedTool.Pointer ||
      this.selectedIds.size > 0 ||
      this.wallAnchor !== null ||
      this.endpointFeedback !== null ||
      this.pusherPlacementPreview !== null ||
      this.gesture?.kind === "wall" ||
      this.gesture?.kind === "marquee"
    );
  }

  get selectedObjects() {
    return this.getObjects().filter((object) =>
      this.selectedIds.has(object.id)
    );
  }

  get selectedObject() {
    const selected = this.selectedObjects;
    return selected.length === 1 ? selected[0] : null;
  }

  get hoveredObject() {
    return this.findObject(this.hoveredId);
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
    const [worldX, worldY] = this.stage.screenToWorld(...screenPoint);
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
      this.selectedIds.clear();
      for (const id of gesture.initialSelection) {
        this.selectedIds.add(id);
      }
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
      this.activeTool === SelectedTool.Wall ||
      this.activeTool === SelectedTool.SpawnPoint ||
      isPusherTool(this.activeTool)
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
    const startScreen = this.stage.worldToScreen(...start);
    const endScreen = this.stage.worldToScreen(...end);
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
        this.stage.worldToScreen(...candidate.position)
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
      const anchorScreen = this.stage.worldToScreen(...anchor.position);
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
      ROTATION_HANDLE_OFFSET / Math.max(Math.abs(this.stage.zoom), 0.001);
    const handle = getRotationHandle(
      getLevelObjectShape(object, this.getDefaultWallThickness()),
      offset
    );
    return (
      this.screenDistance(
        this.stage.worldToScreen(...handle.position),
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
      this.screenDistance(this.stage.worldToScreen(...handle), screenPoint) <=
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
      this.stage.worldToScreen(...point),
      ENDPOINT_SNAP_RADIUS,
      { exclude }
    );
    this.showEndpointFeedback(target, "snap");
    if (target) {
      return [...target.position] as Vec2;
    }
    return this.getGridSnapEnabled()
      ? snapPoint(point, POSITION_SNAP_STEP)
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
      return constrainPointToAngle(
        fixed,
        point,
        ROTATION_SNAP_STEP,
        this.getGridSnapEnabled() ? POSITION_SNAP_STEP : 0
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
    const temporaryPan = this.spaceHeld && event.button === 0;
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
      (this.activeTool === SelectedTool.SpawnPoint ||
        isPusherTool(this.activeTool)) &&
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
        this.selectedIds.clear();
        this.selectedIds.add(endpointObject.id);
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
      4 / Math.max(this.stage.zoom, 0.001),
      this.getDefaultWallThickness()
    );
    if (pickedObject) {
      if (event.shiftKey) {
        if (this.selectedIds.has(pickedObject.id)) {
          this.selectedIds.delete(pickedObject.id);
          this.updateIdleState(screenPoint);
          event.preventDefault();
          return;
        }
        this.selectedIds.add(pickedObject.id);
      } else if (!this.selectedIds.has(pickedObject.id)) {
        this.selectedIds.clear();
        this.selectedIds.add(pickedObject.id);
      }
      this.hoveredId = pickedObject.id;
      if (!this.readOnly) {
        this.beginMove(event, screenPoint);
      }
      event.preventDefault();
      return;
    }

    const initialSelection = new Set(this.selectedIds);
    if (!event.shiftKey) {
      this.selectedIds.clear();
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
      this.stage.panByScreen(
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
        vector = snapPoint(vector, POSITION_SNAP_STEP);
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
        this.selectedIds.clear();
        for (const id of nextSelection) {
          this.selectedIds.add(id);
        }
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
          : snapPoint(rawDelta, POSITION_SNAP_STEP);
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
        this.selectedIds.clear();
        this.selectedIds.add(object.id);
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
        this.selectedIds.clear();
        this.selectedIds.add(object.id);
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
      this.hoveredId = null;
      this.endpointFeedback = null;
      this.updateCursor();
    }
  };

  private readonly wheel = (event: WheelEvent) => {
    const screenPoint = this.screenPoint(event);
    if (event.ctrlKey || event.metaKey) {
      const zoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, this.stage.zoom * Math.exp(-event.deltaY * 0.002))
      );
      this.stage.zoomAtScreenPoint(...screenPoint, zoom);
    } else {
      this.stage.panByScreen(-event.deltaX, -event.deltaY);
    }
    event.preventDefault();
  };

  private updateIdleState(
    screenPoint: Vec2,
    {
      temporarySelection = this.selectionModifierHeld &&
        this.creationToolActive,
    }: { temporarySelection?: boolean } = {}
  ) {
    if (this.gesture) {
      return;
    }
    if (this.spaceHeld || this.activeTool === SelectedTool.Pan) {
      this.hoveredId = null;
      this.stage.canvas.style.cursor = "grab";
      return;
    }
    if (this.creationToolActive && !temporarySelection) {
      this.hoveredId = null;
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
      this.hoveredId = directEndpointTarget.objectId;
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
      this.hoveredId = selectedObject.id;
      this.stage.canvas.style.cursor = this.readOnly ? "default" : "crosshair";
      return;
    }
    const selectedEndpoint = selectedObject
      ? this.endpointAt(selectedObject, screenPoint)
      : null;
    if (selectedObject?.prefab === "wall" && selectedEndpoint) {
      const { start, end } = getWallEndpoints(selectedObject);
      this.hoveredId = selectedObject.id;
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
      this.hoveredId = selectedObject.id;
      this.stage.canvas.style.cursor = this.readOnly ? "default" : "grab";
      return;
    }
    const handle = selectedObject
      ? this.resizeHandleAt(selectedObject, screenPoint)
      : null;
    if (handle) {
      this.hoveredId = selectedObject?.id ?? null;
      this.stage.canvas.style.cursor = this.readOnly
        ? "default"
        : resizeHandleCursor(handle);
      return;
    }
    const hoveredObject = pickLevelObject(
      this.getObjects(),
      this.worldPoint(screenPoint),
      4 / Math.max(this.stage.zoom, 0.001),
      this.getDefaultWallThickness()
    );
    this.hoveredId = hoveredObject?.id ?? null;
    this.stage.canvas.style.cursor =
      hoveredObject && !this.readOnly ? "grab" : "default";
  }

  private updateCursor() {
    if (this.gesture?.kind === "pan") {
      this.stage.canvas.style.cursor = "grabbing";
    } else if (this.spaceHeld || this.activeTool === SelectedTool.Pan) {
      this.stage.canvas.style.cursor = "grab";
    } else if (this.selectionModifierHeld && this.creationToolActive) {
      this.stage.canvas.style.cursor = "default";
    } else if (this.creationToolActive) {
      this.stage.canvas.style.cursor = this.readOnly
        ? "not-allowed"
        : "crosshair";
    } else {
      this.stage.canvas.style.cursor = "default";
    }
  }

  private readonly keyDown = (event: KeyboardEvent) => {
    if (isKeyboardControlTarget(event.target)) {
      return;
    }

    if ((event.key === "Meta" || event.key === "Control") && !event.repeat) {
      this.selectionModifierHeld = true;
      if (this.lastPointerScreen) {
        this.updateIdleState(this.lastPointerScreen, {
          temporarySelection: this.creationToolActive,
        });
      } else {
        this.updateCursor();
      }
      return;
    }

    if (event.key === " " && !event.repeat) {
      this.spaceHeld = true;
      this.updateCursor();
      event.preventDefault();
      return;
    }

    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === "z") {
      this.cancelGesture();
      if (event.shiftKey) {
        this.callbacks.onRedo();
      } else {
        this.callbacks.onUndo();
      }
      event.preventDefault();
      return;
    }
    if (modifier && event.key.toLowerCase() === "y") {
      this.cancelGesture();
      this.callbacks.onRedo();
      event.preventDefault();
      return;
    }
    if (modifier && event.key.toLowerCase() === "a") {
      this.selectedIds.clear();
      for (const object of this.getObjects()) {
        if (!object.locked) {
          this.selectedIds.add(object.id);
        }
      }
      event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      if (this.gesture) {
        this.cancelGesture();
      } else if (this.wallAnchor) {
        this.clearWallAnchor();
      } else if (this.activeTool !== SelectedTool.Pointer) {
        this.callbacks.onToolRequest(SelectedTool.Pointer);
      } else if (this.selectedIds.size > 0) {
        this.clearSelection();
      }
      event.preventDefault();
      return;
    }

    if (event.key === "Enter" && this.wallAnchor) {
      this.clearWallAnchor();
      this.updateCursor();
      event.preventDefault();
      return;
    }

    if (!modifier && !event.altKey) {
      if (event.key.toLowerCase() === "r" && this.readOnly) {
        this.callbacks.onReset();
        event.preventDefault();
        return;
      }
      const toolByKey: Partial<Record<string, SelectedTool>> = {
        v: SelectedTool.Pointer,
        h: SelectedTool.Pan,
        w: SelectedTool.Wall,
        l: SelectedTool.Wall,
        s: SelectedTool.SpawnPoint,
      };
      const requestedTool = toolByKey[event.key.toLowerCase()];
      if (requestedTool !== undefined) {
        if (!this.readOnly || requestedTool === SelectedTool.Pan) {
          this.callbacks.onToolRequest(requestedTool);
        }
        event.preventDefault();
        return;
      }
    }

    const selected = this.selectedObjects;
    if (selected.length === 0 || this.readOnly) {
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      this.cancelGesture();
      this.callbacks.onDelete(selected);
      this.clearSelection();
      event.preventDefault();
      return;
    }

    const directionByKey: Partial<Record<string, Vec2>> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directionByKey[event.key];
    if (!direction) {
      return;
    }
    const distance = event.shiftKey ? 10 : 1;
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
    event.preventDefault();
  };

  private readonly keyUp = (event: KeyboardEvent) => {
    if (event.key === "Meta" || event.key === "Control") {
      this.selectionModifierHeld = false;
      this.endpointFeedback = null;
      if (this.lastPointerScreen) {
        this.updateIdleState(this.lastPointerScreen, {
          temporarySelection: false,
        });
      } else {
        this.updateCursor();
      }
      return;
    }
    if (event.key === " ") {
      this.spaceHeld = false;
      this.updateCursor();
      event.preventDefault();
    }
  };

  private readonly windowBlur = () => {
    this.spaceHeld = false;
    this.selectionModifierHeld = false;
    this.endpointFeedback = null;
    if (this.gesture) {
      this.cancelGesture();
    }
    this.updateCursor();
  };
}
