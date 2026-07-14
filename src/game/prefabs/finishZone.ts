import type { Vec2 } from "../../engine/core/transform";
import type { Color } from "../../engine/vdu/component";
import { rectangleDefinition } from "./primitives/rectangle";

export const finishZoneDefinition = ({
  position,
  rotation = 0,
  width,
  height,
  color = [1, 1, 1, 1],
}: {
  position: Vec2;
  rotation?: number;
  width: number;
  height: number;
  color?: Color;
}) =>
  rectangleDefinition({
    position,
    rotation,
    width,
    height,
    color,
    bodyType: "kinematic",
    sensor: true,
    tags: ["finish-zone"],
  });
