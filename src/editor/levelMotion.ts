import type { Vec2 } from "../engine/core/transform";
import type { LevelObjectData } from "./levelDocument";
import { getLevelObjectShape, type LevelObjectShape } from "./levelGeometry";

export type LevelObjectPose = {
  position: Vec2;
  rotation: number;
};

const rotateVector = ([x, y]: Vec2, angle: number): Vec2 => {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [x * cosine - y * sine, x * sine + y * cosine];
};

const getBasePose = (
  object: LevelObjectData,
  defaultWallThickness: number
): { pose: LevelObjectPose; shape: LevelObjectShape } => {
  const shape = getLevelObjectShape(object, defaultWallThickness);
  return {
    pose: {
      position: [...shape.position],
      rotation: shape.kind === "rectangle" ? shape.rotation : 0,
    },
    shape,
  };
};

export const getLevelObjectMotionPose = (
  object: LevelObjectData,
  defaultWallThickness: number,
  elapsedMs: number
): LevelObjectPose => {
  const { pose: base, shape } = getBasePose(object, defaultWallThickness);
  const motion = object.motion;
  if (!motion) {
    return base;
  }

  const periodMs = Math.max(1, motion.periodMs);
  const cycle = elapsedMs / periodMs + motion.phase;
  const direction = motion.direction;

  if (motion.type === "oscillate") {
    const progress = Math.sin(cycle * Math.PI * 2) * direction;
    return {
      position: [
        base.position[0] + motion.vector[0] * progress,
        base.position[1] + motion.vector[1] * progress,
      ],
      rotation: base.rotation,
    };
  }

  const pivotOffset: Vec2 =
    motion.pivot === "start" && shape.kind === "rectangle"
      ? [-shape.width / 2, 0]
      : [0, 0];
  const pivotOffsetAtRest = rotateVector(pivotOffset, base.rotation);
  const pivot: Vec2 = [
    base.position[0] + pivotOffsetAtRest[0],
    base.position[1] + pivotOffsetAtRest[1],
  ];
  const rotation = base.rotation + cycle * Math.PI * 2 * direction;
  const rotatedPivotOffset = rotateVector(pivotOffset, rotation);

  return {
    position: [
      pivot[0] - rotatedPivotOffset[0],
      pivot[1] - rotatedPivotOffset[1],
    ],
    rotation,
  };
};

export const getOscillationEndpoints = (
  object: LevelObjectData,
  defaultWallThickness: number
): [Vec2, Vec2] | null => {
  if (object.motion?.type !== "oscillate") {
    return null;
  }
  const { position } = getBasePose(object, defaultWallThickness).pose;
  const { vector } = object.motion;
  return [
    [position[0] - vector[0], position[1] - vector[1]],
    [position[0] + vector[0], position[1] + vector[1]],
  ];
};

export const getRotationPivot = (
  object: LevelObjectData,
  defaultWallThickness: number
): Vec2 | null => {
  if (object.motion?.type !== "rotate") {
    return null;
  }
  const { pose, shape } = getBasePose(object, defaultWallThickness);
  if (object.motion.pivot === "center" || shape.kind !== "rectangle") {
    return [...pose.position];
  }
  const offset = rotateVector([-shape.width / 2, 0], pose.rotation);
  return [pose.position[0] + offset[0], pose.position[1] + offset[1]];
};
