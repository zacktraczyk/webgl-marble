import type { Vec2 } from "../engine/core/transform";
import type { LevelObjectData } from "./levelDocument";

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

export const getLevelObjectShape = (
  object: LevelObjectData
): LevelObjectShape => {
  const position: Vec2 = [...object.transform.position];
  const rotation = object.transform.rotation ?? 0;

  switch (object.prefab) {
    case "wall":
    case "finish-zone":
    case "staging-rack":
      return {
        kind: "rectangle",
        position,
        rotation,
        width: object.properties.width,
        height: object.properties.height,
      };
    case "bumper":
    case "spawn-point":
      return {
        kind: "circle",
        position,
        rotation,
        radius: object.properties.radius,
      };
  }
};

export const isLevelObjectResizable = (object: LevelObjectData) =>
  !object.locked &&
  (object.prefab === "wall" ||
    object.prefab === "bumper" ||
    object.prefab === "finish-zone");

export const isLevelObjectRotatable = (object: LevelObjectData) =>
  !object.locked &&
  (object.prefab === "wall" ||
    object.prefab === "finish-zone" ||
    object.prefab === "spawn-point");

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
  tolerance = 0
) => {
  const shape = getLevelObjectShape(object);
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
  tolerance = 0
) => {
  for (let index = objects.length - 1; index >= 0; index--) {
    const object = objects[index];
    if (!object.locked && hitTestLevelObject(object, point, tolerance)) {
      return object;
    }
  }
  return null;
};

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
  object.transform.position = [...shape.position];
  object.transform.rotation = shape.rotation;

  if (shape.kind === "circle") {
    if (object.prefab === "bumper" || object.prefab === "spawn-point") {
      object.properties.radius = shape.radius;
    }
    return;
  }

  if (
    object.prefab === "wall" ||
    object.prefab === "finish-zone" ||
    object.prefab === "staging-rack"
  ) {
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
