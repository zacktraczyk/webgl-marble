import type { EntityDefinition } from "../../engine/core/definition";
import type { Vec2 } from "../../engine/core/transform";
import type { Color } from "../../engine/vdu/component";
import {
  DEFAULT_SPAWN_DIRECTION_VARIANCE,
  spawnAreaRadius,
} from "../race/spawn";

export interface SpawnPointDefinitionOptions {
  position: Vec2;
  rotation?: number;
  radius: number;
  directionVariance?: number;
  marbleCount?: number;
  marbleRadius?: number;
  color?: Color;
}

/** Editor-visible marker. The race controller owns its launch behavior. */
export const spawnPointDefinition = ({
  position,
  rotation = Math.PI / 2,
  radius,
  directionVariance = DEFAULT_SPAWN_DIRECTION_VARIANCE,
  marbleCount = 1,
  marbleRadius = radius * 0.4,
  color = [34 / 255, 211 / 255, 238 / 255, 1],
}: SpawnPointDefinitionOptions): EntityDefinition => {
  const areaRadius = spawnAreaRadius(radius, marbleCount, marbleRadius);
  const directionBound = (angle: number) => ({
    primitive: { type: "rectangle" as const, width: 1, height: 1 },
    color: [color[0], color[1], color[2], 0.7] as Color,
    localTransform: {
      position: [
        Math.cos(angle) * areaRadius * 0.52,
        Math.sin(angle) * areaRadius * 0.52,
      ] as Vec2,
      rotation: angle,
      scale: [areaRadius * 0.9, Math.max(2, areaRadius * 0.07)] as Vec2,
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
          localTransform: {
            position: [0, 0],
            scale: [areaRadius, areaRadius],
          },
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
