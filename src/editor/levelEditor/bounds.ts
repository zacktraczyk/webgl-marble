import type { Vec2 } from "../../engine/core/transform";
import type { Bounds } from "../../game/level/geometry";

export const boundsFromPoints = (first: Vec2, second: Vec2): Bounds => ({
  min: [Math.min(first[0], second[0]), Math.min(first[1], second[1])],
  max: [Math.max(first[0], second[0]), Math.max(first[1], second[1])],
});
