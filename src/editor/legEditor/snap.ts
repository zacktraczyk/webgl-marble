import type { Vec2 } from "../../engine/core/transform";
import {
  snapPointToGrid,
  type GridLayout,
} from "../../game/level/grid";
import { constrainPointToAngle } from "../../game/level/geometry";
import type { WallEndpointFeedback } from "./gestures";
import {
  ENDPOINT_SNAP_RADIUS,
  ROTATION_SNAP_STEP,
} from "./constants";
import type {
  WallEndpointExclusion,
  WallEndpointTarget,
} from "./handles";

export type SnapDeps = {
  worldToScreen: (point: Vec2) => Vec2;
  getGridSnapEnabled: () => boolean;
  getGridLayout: () => GridLayout;
  findWallEndpointTarget: (
    screenPoint: Vec2,
    maximumDistance: number,
    options?: {
      selectableOnly?: boolean;
      exclude?: WallEndpointExclusion;
    }
  ) => WallEndpointTarget | null;
  setEndpointFeedback: (
    target: WallEndpointTarget | null,
    kind: WallEndpointFeedback["kind"]
  ) => void;
};

export function snapPlacementPoint(
  deps: SnapDeps,
  point: Vec2,
  free: boolean,
  exclude?: WallEndpointExclusion
) {
  if (free) {
    deps.setEndpointFeedback(null, "snap");
    return [...point] as Vec2;
  }
  const target = deps.findWallEndpointTarget(
    deps.worldToScreen(point),
    ENDPOINT_SNAP_RADIUS,
    { exclude }
  );
  deps.setEndpointFeedback(target, "snap");
  if (target) {
    return [...target.position] as Vec2;
  }
  return deps.getGridSnapEnabled()
    ? snapPointToGrid(point, deps.getGridLayout())
    : ([...point] as Vec2);
}

export function snapWallEndpoint(
  deps: SnapDeps,
  fixed: Vec2,
  point: Vec2,
  { free, constrain }: { free: boolean; constrain: boolean },
  exclude?: WallEndpointExclusion
) {
  if (free) {
    deps.setEndpointFeedback(null, "snap");
    return [...point] as Vec2;
  }
  if (constrain) {
    deps.setEndpointFeedback(null, "snap");
    const gridStep = deps.getGridLayout().step;
    return constrainPointToAngle(
      fixed,
      point,
      ROTATION_SNAP_STEP,
      deps.getGridSnapEnabled() ? (gridStep[0] + gridStep[1]) / 2 : 0
    );
  }
  return snapPlacementPoint(deps, point, false, exclude);
}
