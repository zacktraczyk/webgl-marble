import type { EntityDefinition } from "../../engine/core/definition";
import type { Vec2 } from "../../engine/core/transform";
import type { Color } from "../../engine/vdu/component";
import { DEFAULT_SPAWN_DIRECTION_VARIANCE } from "../race/spawn";

export interface SpawnPointDefinitionOptions {
  position: Vec2;
  rotation?: number;
  radius: number;
  directionVariance?: number;
  color?: Color;
}

/** Editor-visible marker. The race controller owns its launch behavior. */
export const spawnPointDefinition = ({
  position,
  rotation = Math.PI / 2,
  radius,
  directionVariance = DEFAULT_SPAWN_DIRECTION_VARIANCE,
  color = [34 / 255, 211 / 255, 238 / 255, 1],
}: SpawnPointDefinitionOptions): EntityDefinition => {
  const directionBound = (angle: number) => ({
    primitive: { type: "rectangle" as const, width: 1, height: 1 },
    color,
    localTransform: {
      position: [
        Math.cos(angle) * radius * 0.62,
        Math.sin(angle) * radius * 0.62,
      ] as Vec2,
      rotation: angle,
      scale: [radius, Math.max(3, radius * 0.14)] as Vec2,
    },
  });

  return {
    transform: { position, rotation },
    tags: ["spawn-point"],
    render: {
      parts: [
        {
          primitive: { type: "circle", radius: 1 },
          color: [color[0], color[1], color[2], 0.24],
          localTransform: { position: [0, 0], scale: [radius, radius] },
        },
        {
          primitive: { type: "circle", radius: 1 },
          color,
          localTransform: {
            position: [0, 0],
            scale: [radius * 0.22, radius * 0.22],
          },
        },
        directionBound(-Math.abs(directionVariance)),
        directionBound(Math.abs(directionVariance)),
      ],
    },
  };
};
