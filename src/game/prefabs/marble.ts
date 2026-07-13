import type { EntityDefinition } from "../../engine/core/definition";
import type { Vec2 } from "../../engine/core/transform";
import type { Color } from "../../engine/vdu/component";
import { circleDefinition } from "./primitives/circle";

export interface MarbleDefinitionOptions {
  position: Vec2;
  radius: number;
  color: Color;
  team?: string;
  velocity?: Vec2;
  decorated?: boolean;
}

/** A game-level variation composed from the circle primitive definition. */
export const marbleDefinition = ({
  position,
  radius,
  color,
  team,
  velocity,
  decorated = true,
}: MarbleDefinitionOptions): EntityDefinition => {
  const definition = circleDefinition({
    position,
    radius,
    color,
    velocity,
    bodyType: "dynamic",
    tags: ["marble", ...(team ? [`team:${team}`] : [])],
  });

  if (decorated) {
    definition.render?.parts.push({
      primitive: { type: "circle", radius: 1 },
      color: [1, 1, 1, 0.28],
      localTransform: {
        position: [-radius * 0.28, -radius * 0.3],
        scale: [radius * 0.24, radius * 0.16],
      },
    });
  }

  return definition;
};
