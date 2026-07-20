import type { Vec2 } from "../../engine/core/transform";
import type { LevelObjectData } from "../../game/level/document";
import {
  applyLevelObjectShape,
  getLevelObjectBounds,
  getLevelObjectShape,
  type Bounds,
} from "../../game/level/geometry";
import { moveShape, rotateShape } from "../geometry";

export type SelectionAlignment =
  | "left"
  | "center-horizontal"
  | "right"
  | "top"
  | "center-vertical"
  | "bottom";

export type SelectionDistribution = "horizontal" | "vertical";
export type SelectionMirror = "left-right" | "top-bottom";

export const getSelectionBounds = (
  objects: readonly LevelObjectData[],
  defaultWallThickness: number
): Bounds | null => {
  if (objects.length === 0) {
    return null;
  }
  return objects.reduce<Bounds>(
    (selection, object) => {
      const bounds = getLevelObjectBounds(object, defaultWallThickness);
      return {
        min: [
          Math.min(selection.min[0], bounds.min[0]),
          Math.min(selection.min[1], bounds.min[1]),
        ],
        max: [
          Math.max(selection.max[0], bounds.max[0]),
          Math.max(selection.max[1], bounds.max[1]),
        ],
      };
    },
    {
      min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
      max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    }
  );
};

export const selectionCenter = (bounds: Bounds): Vec2 => [
  (bounds.min[0] + bounds.max[0]) / 2,
  (bounds.min[1] + bounds.max[1]) / 2,
];

export const moveLevelObjectBy = (
  object: LevelObjectData,
  delta: Vec2,
  defaultWallThickness: number
) => {
  const shape = getLevelObjectShape(object, defaultWallThickness);
  applyLevelObjectShape(
    object,
    moveShape(shape, [
      shape.position[0] + delta[0],
      shape.position[1] + delta[1],
    ])
  );
};

export const alignLevelObjects = (
  objects: readonly LevelObjectData[],
  defaultWallThickness: number,
  alignment: SelectionAlignment
) => {
  const selection = getSelectionBounds(objects, defaultWallThickness);
  if (!selection || objects.length < 2) {
    return false;
  }
  const center = selectionCenter(selection);
  for (const object of objects) {
    const bounds = getLevelObjectBounds(object, defaultWallThickness);
    let delta: Vec2;
    switch (alignment) {
      case "left":
        delta = [selection.min[0] - bounds.min[0], 0];
        break;
      case "center-horizontal":
        delta = [center[0] - (bounds.min[0] + bounds.max[0]) / 2, 0];
        break;
      case "right":
        delta = [selection.max[0] - bounds.max[0], 0];
        break;
      case "top":
        delta = [0, selection.min[1] - bounds.min[1]];
        break;
      case "center-vertical":
        delta = [0, center[1] - (bounds.min[1] + bounds.max[1]) / 2];
        break;
      case "bottom":
        delta = [0, selection.max[1] - bounds.max[1]];
        break;
    }
    moveLevelObjectBy(object, delta, defaultWallThickness);
  }
  return true;
};

export const distributeLevelObjects = (
  objects: readonly LevelObjectData[],
  defaultWallThickness: number,
  distribution: SelectionDistribution
) => {
  if (objects.length < 3) {
    return false;
  }
  const axis = distribution === "horizontal" ? 0 : 1;
  const entries = objects
    .map((object) => ({
      object,
      bounds: getLevelObjectBounds(object, defaultWallThickness),
    }))
    .sort((first, second) => first.bounds.min[axis] - second.bounds.min[axis]);
  const first = entries[0].bounds;
  const last = entries.at(-1)?.bounds;
  if (!last) {
    return false;
  }
  const totalSize = entries.reduce(
    (total, entry) => total + entry.bounds.max[axis] - entry.bounds.min[axis],
    0
  );
  const gap =
    (last.max[axis] - first.min[axis] - totalSize) / (entries.length - 1);
  let cursor = first.min[axis];
  for (const entry of entries) {
    const delta = cursor - entry.bounds.min[axis];
    moveLevelObjectBy(
      entry.object,
      axis === 0 ? [delta, 0] : [0, delta],
      defaultWallThickness
    );
    cursor += entry.bounds.max[axis] - entry.bounds.min[axis] + gap;
  }
  return true;
};

export const mirrorLevelObjects = (
  objects: readonly LevelObjectData[],
  defaultWallThickness: number,
  mirror: SelectionMirror,
  center?: Vec2
) => {
  const selection = getSelectionBounds(objects, defaultWallThickness);
  if (!selection) {
    return false;
  }
  const pivot = center ?? selectionCenter(selection);
  for (const object of objects) {
    const shape = getLevelObjectShape(object, defaultWallThickness);
    const leftRight = mirror === "left-right";
    const position: Vec2 = leftRight
      ? [pivot[0] * 2 - shape.position[0], shape.position[1]]
      : [shape.position[0], pivot[1] * 2 - shape.position[1]];
    const rotation = leftRight ? Math.PI - shape.rotation : -shape.rotation;
    applyLevelObjectShape(
      object,
      moveShape(rotateShape(shape, rotation), position)
    );
    if (object.motion?.type === "oscillate") {
      object.motion.vector = leftRight
        ? [-object.motion.vector[0], object.motion.vector[1]]
        : [object.motion.vector[0], -object.motion.vector[1]];
    } else if (object.motion?.type === "rotate") {
      object.motion.direction = object.motion.direction === 1 ? -1 : 1;
    }
  }
  return true;
};
