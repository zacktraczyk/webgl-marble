import type { Vec2 } from "../engine/core/transform";
import type { LevelObjectData } from "../game/level/document";
import {
  hitTestLevelObject,
  localToWorld,
  worldToLocal,
  type Bounds,
  type LevelObjectShape,
} from "../game/level/geometry";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type ResizeAnchor = {
  handle: ResizeHandle;
  position: Vec2;
};

export type RotationHandle = {
  connection: Vec2;
  position: Vec2;
};

const rectangleHandles: ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];
const circleHandles: ResizeHandle[] = ["n", "e", "s", "w"];

const handleDirection: Record<ResizeHandle, Vec2> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};

const snap = (value: number, step: number) =>
  step > 0 ? Math.round(value / step) * step : value;

const snapPoint = ([x, y]: Vec2, step: number): Vec2 => [
  snap(x, step),
  snap(y, step),
];

export const constrainDeltaToAxis = ([x, y]: Vec2): Vec2 =>
  Math.abs(x) >= Math.abs(y) ? [x, 0] : [0, y];

export const findNearestPointIndex = (
  points: readonly Vec2[],
  target: Vec2,
  maximumDistance: number
) => {
  let nearestIndex: number | null = null;
  let nearestDistance = maximumDistance;
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const distance = Math.hypot(point[0] - target[0], point[1] - target[1]);
    if (distance <= nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }
  return nearestIndex;
};

export const constrainPointToAngle = (
  origin: Vec2,
  point: Vec2,
  angleStep: number,
  distanceStep = 0
): Vec2 => {
  const deltaX = point[0] - origin[0];
  const deltaY = point[1] - origin[1];
  const rawDistance = Math.hypot(deltaX, deltaY);
  const distance = snap(rawDistance, distanceStep);
  const angle = snap(Math.atan2(deltaY, deltaX), angleStep);
  return [
    origin[0] + Math.cos(angle) * distance,
    origin[1] + Math.sin(angle) * distance,
  ];
};

export const getResizeAnchors = (shape: LevelObjectShape): ResizeAnchor[] => {
  const handles = shape.kind === "rectangle" ? rectangleHandles : circleHandles;
  return handles.map((handle) => {
    const [horizontal, vertical] = handleDirection[handle];
    const localPosition: Vec2 =
      shape.kind === "rectangle"
        ? [horizontal * (shape.width / 2), vertical * (shape.height / 2)]
        : [horizontal * shape.radius, vertical * shape.radius];
    return { handle, position: localToWorld(shape, localPosition) };
  });
};

export const getRotationHandle = (
  shape: LevelObjectShape,
  offset: number
): RotationHandle => {
  const edge = shape.kind === "rectangle" ? shape.height / 2 : shape.radius;
  return {
    connection: localToWorld(shape, [0, -edge]),
    position: localToWorld(shape, [0, -edge - offset]),
  };
};

export const PICK_TOLERANCE_PIXELS = 4;

export const pickTolerance = (zoom: number) =>
  PICK_TOLERANCE_PIXELS / Math.max(zoom, 0.001);

export const pickLevelObject = (
  objects: readonly LevelObjectData[],
  point: Vec2,
  tolerance = 0,
  defaultWallThickness = 25
) => {
  for (let index = objects.length - 1; index >= 0; index--) {
    const object = objects[index];
    if (
      !object.locked &&
      hitTestLevelObject(object, point, tolerance, defaultWallThickness)
    ) {
      return object;
    }
  }
  return null;
};

export const boundsIntersect = (first: Bounds, second: Bounds) =>
  first.min[0] <= second.max[0] &&
  first.max[0] >= second.min[0] &&
  first.min[1] <= second.max[1] &&
  first.max[1] >= second.min[1];

export const moveShape = (
  shape: LevelObjectShape,
  position: Vec2,
  snapStep = 0
): LevelObjectShape => ({
  ...shape,
  position: snapPoint(position, snapStep),
});

export const rotateShape = (
  shape: LevelObjectShape,
  rotation: number,
  snapStep = 0
): LevelObjectShape => ({
  ...shape,
  position: [...shape.position],
  rotation: snap(rotation, snapStep),
});

export const resizeShape = (
  shape: LevelObjectShape,
  handle: ResizeHandle,
  pointer: Vec2,
  snapStep = 0,
  minimumSize = 10
): LevelObjectShape => {
  const [horizontal, vertical] = handleDirection[handle];
  const [pointerX, pointerY] = worldToLocal(shape, pointer);

  if (shape.kind === "circle") {
    const rawRadius =
      horizontal === 0 ? Math.abs(pointerY) : Math.abs(pointerX);
    const radius = Math.max(minimumSize, snap(rawRadius, snapStep));
    return { ...shape, position: [...shape.position], radius };
  }

  let width = shape.width;
  let height = shape.height;
  let centerX = 0;
  let centerY = 0;

  if (horizontal !== 0) {
    const fixedEdge = (-horizontal * shape.width) / 2;
    const desiredWidth = (pointerX - fixedEdge) * horizontal;
    width = Math.max(minimumSize, snap(desiredWidth, snapStep));
    const movingEdge = fixedEdge + horizontal * width;
    centerX = (fixedEdge + movingEdge) / 2;
  }

  if (vertical !== 0) {
    const fixedEdge = (-vertical * shape.height) / 2;
    const desiredHeight = (pointerY - fixedEdge) * vertical;
    height = Math.max(minimumSize, snap(desiredHeight, snapStep));
    const movingEdge = fixedEdge + vertical * height;
    centerY = (fixedEdge + movingEdge) / 2;
  }

  return {
    ...shape,
    position: localToWorld(shape, [centerX, centerY]),
    width,
    height,
  };
};

export const resizeHandleCursor = (handle: ResizeHandle) => {
  switch (handle) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
  }
};

export const boundsFromPoints = (first: Vec2, second: Vec2): Bounds => ({
  min: [Math.min(first[0], second[0]), Math.min(first[1], second[1])],
  max: [Math.max(first[0], second[0]), Math.max(first[1], second[1])],
});
