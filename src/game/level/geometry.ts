import type { Vec2 } from "../../engine/core/transform";
import type { LevelObjectData } from "./document";

export type RectangleLevelShape = {
  kind: "rectangle";
  position: Vec2;
  rotation: number;
  width: number;
  height: number;
};

export type CircleLevelShape = {
  kind: "circle";
  position: Vec2;
  rotation: number;
  radius: number;
};

export type LevelObjectShape = RectangleLevelShape | CircleLevelShape;

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type ResizeAnchor = {
  handle: ResizeHandle;
  position: Vec2;
};

export type RotationHandle = {
  connection: Vec2;
  position: Vec2;
};

export type Bounds = {
  min: Vec2;
  max: Vec2;
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

export const snapPoint = ([x, y]: Vec2, step: number): Vec2 => [
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

export const getWallThickness = (
  object: Extract<LevelObjectData, { prefab: "wall" }>,
  defaultWallThickness: number
) => object.properties.thickness ?? defaultWallThickness;

export const getWallEndpoints = (
  object: Extract<LevelObjectData, { prefab: "wall" }>
) => ({
  start: [...object.properties.start] as Vec2,
  end: [...object.properties.end] as Vec2,
});

export const setWallEndpoints = (
  object: Extract<LevelObjectData, { prefab: "wall" }>,
  start: Vec2,
  end: Vec2
) => {
  object.properties.start = [...start];
  object.properties.end = [...end];
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

export const getLevelObjectShape = (
  object: LevelObjectData,
  defaultWallThickness = 25
): LevelObjectShape => {
  switch (object.prefab) {
    case "wall": {
      const { start, end } = getWallEndpoints(object);
      return {
        kind: "rectangle",
        position: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
        rotation: Math.atan2(end[1] - start[1], end[0] - start[0]),
        width: Math.hypot(end[0] - start[0], end[1] - start[1]),
        height: getWallThickness(object, defaultWallThickness),
      };
    }
    case "finish-zone":
    case "staging-rack":
      return {
        kind: "rectangle",
        position: [...object.transform.position],
        rotation: object.transform.rotation ?? 0,
        width: object.properties.width,
        height: object.properties.height,
      };
    case "bumper":
    case "spawn-point":
      return {
        kind: "circle",
        position: [...object.transform.position],
        rotation: object.transform.rotation ?? 0,
        radius: object.properties.radius,
      };
  }
};

export const isLevelObjectResizable = (object: LevelObjectData) =>
  !object.locked &&
  (object.prefab === "bumper" || object.prefab === "finish-zone");

export const isLevelObjectRotatable = (object: LevelObjectData) =>
  !object.locked &&
  (object.prefab === "finish-zone" || object.prefab === "spawn-point");

export const localToWorld = (shape: LevelObjectShape, [x, y]: Vec2): Vec2 => {
  const cosine = Math.cos(shape.rotation);
  const sine = Math.sin(shape.rotation);
  return [
    shape.position[0] + x * cosine - y * sine,
    shape.position[1] + x * sine + y * cosine,
  ];
};

export const worldToLocal = (shape: LevelObjectShape, [x, y]: Vec2): Vec2 => {
  const offsetX = x - shape.position[0];
  const offsetY = y - shape.position[1];
  const cosine = Math.cos(shape.rotation);
  const sine = Math.sin(shape.rotation);
  return [
    offsetX * cosine + offsetY * sine,
    -offsetX * sine + offsetY * cosine,
  ];
};

export const getRectangleCorners = (shape: RectangleLevelShape): Vec2[] => [
  localToWorld(shape, [-shape.width / 2, -shape.height / 2]),
  localToWorld(shape, [shape.width / 2, -shape.height / 2]),
  localToWorld(shape, [shape.width / 2, shape.height / 2]),
  localToWorld(shape, [-shape.width / 2, shape.height / 2]),
];

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

export const hitTestLevelObject = (
  object: LevelObjectData,
  point: Vec2,
  tolerance = 0,
  defaultWallThickness = 25
) => {
  const shape = getLevelObjectShape(object, defaultWallThickness);
  const [x, y] = worldToLocal(shape, point);
  if (shape.kind === "circle") {
    return Math.hypot(x, y) <= shape.radius + tolerance;
  }
  return (
    Math.abs(x) <= shape.width / 2 + tolerance &&
    Math.abs(y) <= shape.height / 2 + tolerance
  );
};

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

export const getLevelObjectBounds = (
  object: LevelObjectData,
  defaultWallThickness = 25
): Bounds => {
  const shape = getLevelObjectShape(object, defaultWallThickness);
  const points =
    shape.kind === "rectangle"
      ? getRectangleCorners(shape)
      : [
          [shape.position[0] - shape.radius, shape.position[1] - shape.radius],
          [shape.position[0] + shape.radius, shape.position[1] + shape.radius],
        ];
  return points.reduce<Bounds>(
    (bounds, [x, y]) => ({
      min: [Math.min(bounds.min[0], x), Math.min(bounds.min[1], y)],
      max: [Math.max(bounds.max[0], x), Math.max(bounds.max[1], y)],
    }),
    {
      min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
      max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    }
  );
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

export const applyLevelObjectShape = (
  object: LevelObjectData,
  shape: LevelObjectShape
) => {
  if (object.prefab === "wall") {
    if (shape.kind !== "rectangle") {
      return;
    }
    setWallEndpoints(
      object,
      localToWorld(shape, [-shape.width / 2, 0]),
      localToWorld(shape, [shape.width / 2, 0])
    );
    return;
  }

  object.transform.position = [...shape.position];
  object.transform.rotation = shape.rotation;

  if (shape.kind === "circle") {
    if (object.prefab === "bumper" || object.prefab === "spawn-point") {
      object.properties.radius = shape.radius;
    }
    return;
  }

  if (object.prefab === "finish-zone" || object.prefab === "staging-rack") {
    object.properties.width = shape.width;
    object.properties.height = shape.height;
  }
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
