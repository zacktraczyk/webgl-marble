import type { Vec2 } from "../../engine/core/transform";
import type { GridLayout } from "../../game/level/grid";
import {
  getLevelObjectShape,
  getWallEndpoints,
} from "../../game/level/geometry";
import { pickLevelObject, type ResizeHandle } from "../geometry";
import type { LevelObjectData } from "../../game/level/document";
import { isPusherTool, SelectedTool, type PusherTool } from "../tools";
import { HANDLE_HIT_RADIUS, MIN_WALL_LENGTH } from "./constants";
import {
  updateMarqueeDrag,
  updateMotionRangeDrag,
  updateMoveDrag,
  updateTransformDrag,
  updateWallDrag,
  updateWallEndpointDrag,
} from "./gestureDrag";
import type {
  EditorGesture,
  TransformGesture,
  WallEndpointFeedback,
} from "./gestures";
import {
  endpointAt,
  findWallEndpointTarget,
  motionRangeHandleAt,
  resizeHandleAt,
  rotationHandleAt,
  type HandleTestDeps,
  type WallEndpointTarget,
} from "./handles";
import type { LegEditorKeyboard } from "./keyboard";
import type { LegEditorSelection } from "./selection";
import { snapPlacementPoint, snapWallEndpoint, type SnapDeps } from "./snap";

type PointerGestureCallbacks = {
  onObjectsChange(objects: readonly LevelObjectData[]): void;
  onObjectsCommit(objects: readonly LevelObjectData[]): void;
  onCreateWall(start: Vec2, end: Vec2): LevelObjectData;
  onPlaceObject(tool: PusherTool, position: Vec2): LevelObjectData;
  onToolComplete(tool: SelectedTool): void;
  onInsert(objects: readonly LevelObjectData[]): LevelObjectData[];
  onDiscard(objects: readonly LevelObjectData[]): void;
};

type PointerCameraControls = {
  panByScreen(deltaX: number, deltaY: number): void;
};

export type PointerGestureHost = {
  gesture: EditorGesture | null;
  wallAnchor: Vec2 | null;
  wallPreviewEnd: Vec2 | null;
  endpointFeedback: WallEndpointFeedback | null;
  placementPreviewPosition: Vec2 | null;
  lastPointerScreen: Vec2 | null;
  activeTool: SelectedTool;
  readOnly: boolean;
  handleDeps: HandleTestDeps;
  snapDeps: SnapDeps;
  dragDeps: {
    screenDistance: (first: Vec2, second: Vec2) => number;
    getDefaultWallThickness: () => number;
    getGridSnapEnabled: () => boolean;
    getGridLayout: () => GridLayout;
    getObjects: () => readonly LevelObjectData[];
    findObject: (id: string) => LevelObjectData | null | undefined;
    onObjectsChange: (objects: readonly LevelObjectData[]) => void;
  };
  selection: LegEditorSelection;
  callbacks: PointerGestureCallbacks;
  cameraControls: PointerCameraControls;
  keyboard: Pick<LegEditorKeyboard, "spaceHeld">;
  creationToolActive: boolean;
  selectedObject: LevelObjectData | null;
  selectedObjects: readonly LevelObjectData[];
  cameraZoom: number;
  screenPoint(event: PointerEvent): Vec2;
  worldPoint(screenPoint: Vec2): Vec2;
  screenDistance(first: Vec2, second: Vec2): number;
  capturePointer(pointerId: number): void;
  releasePointer(pointerId: number): void;
  cancelGesture(): void;
  updateIdleState(
    screenPoint: Vec2,
    options?: { temporarySelection?: boolean }
  ): void;
  showEndpointFeedback(
    target: WallEndpointTarget | null,
    kind: WallEndpointFeedback["kind"]
  ): void;
  isTemporarySelection(modifier: {
    metaKey: boolean;
    ctrlKey: boolean;
  }): boolean;
  clearWallAnchor(): void;
  getObjects(): readonly LevelObjectData[];
  getDefaultWallThickness(): number;
  setCursor(cursor: string): void;
};

export function beginPan(
  host: PointerGestureHost,
  event: PointerEvent,
  screenPoint: Vec2
) {
  host.gesture = {
    kind: "pan",
    pointerId: event.pointerId,
    lastScreen: screenPoint,
  };
  host.capturePointer(event.pointerId);
  host.setCursor("grabbing");
}

export function beginMove(
  host: PointerGestureHost,
  event: PointerEvent,
  screenPoint: Vec2,
  options: { inserted?: boolean; sourceSelection?: string[] } = {}
) {
  const originals = new Map(
    host.selectedObjects.map((object) => [object.id, structuredClone(object)])
  );
  host.gesture = {
    kind: "move",
    pointerId: event.pointerId,
    startWorld: host.worldPoint(screenPoint),
    startScreen: screenPoint,
    originals,
    inserted: options.inserted ?? false,
    sourceSelection: options.sourceSelection ?? [],
    changed: false,
  };
  host.capturePointer(event.pointerId);
  host.setCursor("grabbing");
}

export function beginTransform(
  host: PointerGestureHost,
  event: PointerEvent,
  object: LevelObjectData,
  kind: TransformGesture["kind"],
  screenPoint: Vec2,
  handle?: ResizeHandle
) {
  host.gesture = {
    kind,
    pointerId: event.pointerId,
    objectId: object.id,
    handle,
    startShape: getLevelObjectShape(object, host.getDefaultWallThickness()),
    startWorld: host.worldPoint(screenPoint),
    startScreen: screenPoint,
    changed: false,
  };
  host.capturePointer(event.pointerId);
}

function tryBeginPan(
  host: PointerGestureHost,
  event: PointerEvent,
  screenPoint: Vec2
): boolean {
  const temporaryPan = host.keyboard.spaceHeld && event.button === 0;
  if (
    event.button === 1 ||
    temporaryPan ||
    (host.activeTool === SelectedTool.Pan && event.button === 0)
  ) {
    beginPan(host, event, screenPoint);
    event.preventDefault();
    return true;
  }
  return false;
}

function tryBeginWallDraw(
  host: PointerGestureHost,
  event: PointerEvent,
  screenPoint: Vec2,
  temporarySelection: boolean
): boolean {
  if (
    host.activeTool !== SelectedTool.Wall ||
    temporarySelection ||
    host.readOnly
  ) {
    return false;
  }
  const worldPoint = host.worldPoint(screenPoint);
  const existingAnchor = host.wallAnchor;
  const anchored = existingAnchor !== null;
  const start = existingAnchor
    ? ([...existingAnchor] as Vec2)
    : snapPlacementPoint(host.snapDeps, worldPoint, event.altKey);
  const end = anchored
    ? snapWallEndpoint(host.snapDeps, start, worldPoint, {
        free: event.altKey,
        constrain: event.shiftKey,
      })
    : ([...start] as Vec2);
  host.gesture = {
    kind: "wall",
    pointerId: event.pointerId,
    start,
    end,
    startScreen: screenPoint,
    anchored,
    changed: false,
  };
  host.capturePointer(event.pointerId);
  event.preventDefault();
  return true;
}

function tryBeginPlacement(
  host: PointerGestureHost,
  event: PointerEvent,
  screenPoint: Vec2,
  temporarySelection: boolean
): boolean {
  if (!isPusherTool(host.activeTool) || temporarySelection || host.readOnly) {
    return false;
  }
  host.gesture = {
    kind: "place",
    pointerId: event.pointerId,
    tool: host.activeTool,
    startScreen: screenPoint,
  };
  host.capturePointer(event.pointerId);
  event.preventDefault();
  return true;
}

function tryBeginMotionRange(
  host: PointerGestureHost,
  event: PointerEvent,
  screenPoint: Vec2
): boolean {
  const selectedObject = host.selectedObject;
  if (
    !selectedObject ||
    !motionRangeHandleAt(host.handleDeps, selectedObject, screenPoint) ||
    host.readOnly ||
    !selectedObject.motion
  ) {
    return false;
  }
  host.gesture = {
    kind: "motion-range",
    pointerId: event.pointerId,
    objectId: selectedObject.id,
    startMotion: structuredClone(selectedObject.motion),
    startScreen: screenPoint,
    changed: false,
  };
  host.capturePointer(event.pointerId);
  event.preventDefault();
  return true;
}

function tryBeginWallEndpoint(
  host: PointerGestureHost,
  event: PointerEvent,
  screenPoint: Vec2,
  temporarySelection: boolean
): boolean {
  const selectedObject = host.selectedObject;
  const directEndpointTarget = temporarySelection
    ? findWallEndpointTarget(host.handleDeps, screenPoint, HANDLE_HIT_RADIUS, {
        selectableOnly: true,
      })
    : null;
  const endpointObject =
    directEndpointTarget?.object ??
    (selectedObject?.prefab === "wall" ? selectedObject : null);
  const endpoint =
    directEndpointTarget?.endpoint ??
    (endpointObject
      ? endpointAt(host.handleDeps, endpointObject, screenPoint)
      : null);
  if (!endpointObject || !endpoint || host.readOnly) {
    return false;
  }
  if (directEndpointTarget) {
    host.selection.replace(endpointObject.id);
  }
  const { start, end } = getWallEndpoints(endpointObject);
  host.gesture = {
    kind: "wall-endpoint",
    pointerId: event.pointerId,
    objectId: endpointObject.id,
    endpoint,
    start,
    end,
    startScreen: screenPoint,
    changed: false,
  };
  host.showEndpointFeedback(directEndpointTarget, "edit");
  host.capturePointer(event.pointerId);
  event.preventDefault();
  return true;
}

function tryBeginTransform(
  host: PointerGestureHost,
  event: PointerEvent,
  screenPoint: Vec2
): boolean {
  const selectedObject = host.selectedObject;
  if (!selectedObject || host.readOnly) {
    return false;
  }
  if (rotationHandleAt(host.handleDeps, selectedObject, screenPoint)) {
    beginTransform(host, event, selectedObject, "rotate", screenPoint);
    event.preventDefault();
    return true;
  }
  const resizeHandle = resizeHandleAt(
    host.handleDeps,
    selectedObject,
    screenPoint
  );
  if (resizeHandle) {
    beginTransform(
      host,
      event,
      selectedObject,
      "resize",
      screenPoint,
      resizeHandle
    );
    event.preventDefault();
    return true;
  }
  return false;
}

function tryBeginMoveOrMarquee(
  host: PointerGestureHost,
  event: PointerEvent,
  screenPoint: Vec2
): boolean {
  const pickedObject = pickLevelObject(
    host.getObjects(),
    host.worldPoint(screenPoint),
    4 / Math.max(host.cameraZoom, 0.001),
    host.getDefaultWallThickness()
  );
  if (pickedObject) {
    if (event.shiftKey) {
      if (host.selection.has(pickedObject.id)) {
        host.selection.delete(pickedObject.id);
        host.updateIdleState(screenPoint);
        event.preventDefault();
        return true;
      }
      host.selection.add(pickedObject.id);
    } else if (!host.selection.has(pickedObject.id)) {
      host.selection.replace(pickedObject.id);
    }
    host.selection.setHovered(pickedObject.id);
    if (!host.readOnly) {
      if (event.altKey) {
        const sourceSelection = host.selectedObjects.map((object) => object.id);
        const copies = host.callbacks.onInsert(
          structuredClone(host.selectedObjects).filter(
            (object) => object.prefab !== "spawn-point"
          )
        );
        if (copies.length > 0) {
          host.selection.replaceAll(copies.map((object) => object.id));
          beginMove(host, event, screenPoint, {
            inserted: true,
            sourceSelection,
          });
        }
      } else {
        beginMove(host, event, screenPoint);
      }
    }
    event.preventDefault();
    return true;
  }

  const initialSelection = host.selection.snapshot();
  if (!event.shiftKey) {
    host.selection.clear();
  }
  const worldPoint = host.worldPoint(screenPoint);
  host.gesture = {
    kind: "marquee",
    pointerId: event.pointerId,
    startWorld: worldPoint,
    currentWorld: worldPoint,
    startScreen: screenPoint,
    additive: event.shiftKey,
    initialSelection,
    changed: false,
  };
  host.capturePointer(event.pointerId);
  event.preventDefault();
  return true;
}

export function handlePointerDown(
  host: PointerGestureHost,
  event: PointerEvent
) {
  const screenPoint = host.screenPoint(event);
  host.lastPointerScreen = screenPoint;

  if (tryBeginPan(host, event, screenPoint)) {
    return;
  }
  if (event.button !== 0) {
    return;
  }

  const temporarySelection = host.isTemporarySelection(event);
  if (tryBeginWallDraw(host, event, screenPoint, temporarySelection)) {
    return;
  }
  if (tryBeginPlacement(host, event, screenPoint, temporarySelection)) {
    return;
  }
  if (host.activeTool !== SelectedTool.Pointer && !temporarySelection) {
    return;
  }
  if (tryBeginMotionRange(host, event, screenPoint)) {
    return;
  }
  if (tryBeginWallEndpoint(host, event, screenPoint, temporarySelection)) {
    return;
  }
  if (tryBeginTransform(host, event, screenPoint)) {
    return;
  }
  tryBeginMoveOrMarquee(host, event, screenPoint);
}

export function handlePointerMove(
  host: PointerGestureHost,
  event: PointerEvent
) {
  const screenPoint = host.screenPoint(event);
  host.lastPointerScreen = screenPoint;
  if (!host.gesture) {
    const temporarySelection = host.isTemporarySelection(event);
    const snapDeps = host.snapDeps;
    if (
      host.activeTool === SelectedTool.Wall &&
      host.wallAnchor &&
      !temporarySelection &&
      !host.readOnly
    ) {
      host.wallPreviewEnd = snapWallEndpoint(
        snapDeps,
        host.wallAnchor,
        host.worldPoint(screenPoint),
        {
          free: event.altKey,
          constrain: event.shiftKey,
        }
      );
    } else if (
      host.creationToolActive &&
      !temporarySelection &&
      !host.readOnly
    ) {
      const position = snapPlacementPoint(
        snapDeps,
        host.worldPoint(screenPoint),
        event.altKey
      );
      host.placementPreviewPosition = isPusherTool(host.activeTool)
        ? position
        : null;
    } else if (temporarySelection) {
      host.endpointFeedback = null;
      host.placementPreviewPosition = null;
    }
    host.updateIdleState(screenPoint, {
      temporarySelection,
    });
    return;
  }

  if (event.pointerId !== host.gesture.pointerId) {
    return;
  }

  if (host.gesture.kind === "pan") {
    host.cameraControls.panByScreen(
      screenPoint[0] - host.gesture.lastScreen[0],
      screenPoint[1] - host.gesture.lastScreen[1]
    );
    host.gesture.lastScreen = screenPoint;
    event.preventDefault();
    return;
  }

  const worldPoint = host.worldPoint(screenPoint);
  const dragDeps = host.dragDeps;
  const snapDeps = host.snapDeps;
  let result: "pending" | "handled" | "cancel";

  switch (host.gesture.kind) {
    case "motion-range":
      result = updateMotionRangeDrag(
        host.gesture,
        screenPoint,
        worldPoint,
        event,
        dragDeps
      );
      break;
    case "wall":
      result = updateWallDrag(host.gesture, screenPoint, worldPoint, event, {
        ...dragDeps,
        snapDeps,
      });
      break;
    case "place":
      result = "handled";
      break;
    case "marquee":
      result = updateMarqueeDrag(host.gesture, screenPoint, worldPoint, {
        ...dragDeps,
        selection: host.selection,
      });
      break;
    case "move":
      result = updateMoveDrag(
        host.gesture,
        screenPoint,
        worldPoint,
        event,
        dragDeps
      );
      break;
    case "wall-endpoint":
      result = updateWallEndpointDrag(
        host.gesture,
        screenPoint,
        worldPoint,
        event,
        { ...dragDeps, snapDeps }
      );
      break;
    case "resize":
    case "rotate":
      result = updateTransformDrag(
        host.gesture,
        screenPoint,
        worldPoint,
        event,
        dragDeps
      );
      break;
    default:
      return;
  }

  if (result === "pending") {
    return;
  }
  if (result === "cancel") {
    host.cancelGesture();
    return;
  }
  event.preventDefault();
}

export function handlePointerUp(host: PointerGestureHost, event: PointerEvent) {
  if (!host.gesture || event.pointerId !== host.gesture.pointerId) {
    return;
  }
  const gesture = host.gesture;
  const screenPoint = host.screenPoint(event);
  host.lastPointerScreen = screenPoint;
  host.gesture = null;
  host.releasePointer(event.pointerId);

  if (gesture.kind === "wall") {
    const length = Math.hypot(
      gesture.end[0] - gesture.start[0],
      gesture.end[1] - gesture.start[1]
    );
    if ((gesture.changed || gesture.anchored) && length >= MIN_WALL_LENGTH) {
      const object = host.callbacks.onCreateWall(gesture.start, gesture.end);
      host.selection.replace(object.id);
      if (gesture.anchored) {
        host.wallAnchor = [...gesture.end];
        host.wallPreviewEnd = [...gesture.end];
      } else {
        host.clearWallAnchor();
      }
      host.callbacks.onToolComplete(SelectedTool.Wall);
    } else if (!gesture.anchored) {
      host.wallAnchor = [...gesture.start];
      host.wallPreviewEnd = [...gesture.start];
    } else {
      host.wallPreviewEnd = [...gesture.end];
    }
  } else if (gesture.kind === "place") {
    if (host.screenDistance(screenPoint, gesture.startScreen) < 8) {
      const position = snapPlacementPoint(
        host.snapDeps,
        host.worldPoint(screenPoint),
        event.altKey
      );
      const object = host.callbacks.onPlaceObject(gesture.tool, position);
      host.selection.replace(object.id);
      host.placementPreviewPosition = null;
      host.callbacks.onToolComplete(gesture.tool);
    }
  } else if (gesture.kind === "move" && gesture.inserted && !gesture.changed) {
    host.callbacks.onDiscard(host.selectedObjects);
    host.selection.replaceAll(gesture.sourceSelection);
  } else if (
    (gesture.kind === "move" ||
      gesture.kind === "resize" ||
      gesture.kind === "rotate" ||
      gesture.kind === "wall-endpoint" ||
      gesture.kind === "motion-range") &&
    gesture.changed
  ) {
    host.callbacks.onObjectsCommit(host.selectedObjects);
  }

  host.updateIdleState(screenPoint, {
    temporarySelection: host.isTemporarySelection(event),
  });
  event.preventDefault();
}
