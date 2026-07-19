import type { Vec2 } from "../../engine/core/transform";
import type { LevelObjectData } from "../../game/level/document";
import {
  findNearestPointIndex,
  getLevelObjectShape,
  getRotationHandle,
  getResizeAnchors,
  getWallEndpoints,
  isLevelObjectRotatable,
  isLevelObjectResizable,
  type ResizeHandle,
} from "../../game/level/geometry";
import type { WallEndpointFeedback } from "./gestures";
import { HANDLE_HIT_RADIUS, ROTATION_HANDLE_OFFSET } from "./constants";
import { getOscillationEndpoints } from "../../game/level/motion";

export type WallObject = Extract<LevelObjectData, { prefab: "wall" }>;
export type WallEndpointTarget = Omit<WallEndpointFeedback, "kind"> & {
  object: WallObject;
};
export type WallEndpointExclusion = Pick<
  WallEndpointTarget,
  "objectId" | "endpoint"
>;

export type HandleTestDeps = {
  worldToScreen: (point: Vec2) => Vec2;
  screenDistance: (first: Vec2, second: Vec2) => number;
  getObjects: () => readonly LevelObjectData[];
  getDefaultWallThickness: () => number;
  cameraZoom: number;
};

export function endpointAt(
  deps: HandleTestDeps,
  object: LevelObjectData,
  screenPoint: Vec2
) {
  if (object.prefab !== "wall") {
    return null;
  }
  const { start, end } = getWallEndpoints(object);
  const startScreen = deps.worldToScreen(start);
  const endScreen = deps.worldToScreen(end);
  if (deps.screenDistance(startScreen, screenPoint) <= HANDLE_HIT_RADIUS) {
    return "start" as const;
  }
  if (deps.screenDistance(endScreen, screenPoint) <= HANDLE_HIT_RADIUS) {
    return "end" as const;
  }
  return null;
}

export function findWallEndpointTarget(
  deps: HandleTestDeps,
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
  const candidates = deps.getObjects().flatMap((object) => {
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
    candidates.map((candidate) => deps.worldToScreen(candidate.position)),
    screenPoint,
    maximumDistance
  );
  return nearestIndex === null ? null : candidates[nearestIndex];
}

export function resizeHandleAt(
  deps: HandleTestDeps,
  object: LevelObjectData,
  screenPoint: Vec2
) {
  if (!isLevelObjectResizable(object)) {
    return null;
  }
  const shape = getLevelObjectShape(object, deps.getDefaultWallThickness());
  for (const anchor of getResizeAnchors(shape)) {
    const anchorScreen = deps.worldToScreen(anchor.position);
    if (deps.screenDistance(anchorScreen, screenPoint) <= HANDLE_HIT_RADIUS) {
      return anchor.handle;
    }
  }
  return null;
}

export function rotationHandleAt(
  deps: HandleTestDeps,
  object: LevelObjectData,
  screenPoint: Vec2
) {
  if (!isLevelObjectRotatable(object)) {
    return false;
  }
  const offset =
    ROTATION_HANDLE_OFFSET / Math.max(Math.abs(deps.cameraZoom), 0.001);
  const handle = getRotationHandle(
    getLevelObjectShape(object, deps.getDefaultWallThickness()),
    offset
  );
  return (
    deps.screenDistance(deps.worldToScreen(handle.position), screenPoint) <=
    HANDLE_HIT_RADIUS
  );
}

export function motionRangeHandleAt(
  deps: HandleTestDeps,
  object: LevelObjectData,
  screenPoint: Vec2
) {
  if (object.motion?.type !== "oscillate") {
    return false;
  }
  const endpoints = getOscillationEndpoints(
    object,
    deps.getDefaultWallThickness()
  );
  if (!endpoints) {
    return false;
  }
  const handle = endpoints[1];
  return (
    deps.screenDistance(deps.worldToScreen(handle), screenPoint) <=
    HANDLE_HIT_RADIUS + 2
  );
}

export type { ResizeHandle };
