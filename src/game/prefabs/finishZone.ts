import type { Vec2 } from "../../engine/core/transform";
import type { Color } from "../../engine/vdu/component";
import { rectangleDefinition } from "./primitives/rectangle";

export const finishZoneDefinition = ({
  position,
  width,
  height,
  color = [1, 1, 1, 1],
}: {
  position: Vec2;
  width: number;
  height: number;
  color?: Color;
}) =>
  rectangleDefinition({
    position,
    width,
    height,
    color,
    bodyType: "kinematic",
    tags: ["finish-zone"],
  });
