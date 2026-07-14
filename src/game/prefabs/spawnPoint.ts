import type { EntityDefinition } from "../../engine/core/definition";
import type { Vec2 } from "../../engine/core/transform";
import type { Color } from "../../engine/vdu/component";

export interface SpawnPointDefinitionOptions {
  position: Vec2;
  rotation?: number;
  radius: number;
  color?: Color;
}

/** Editor-visible marker. The race controller owns its launch behavior. */
export const spawnPointDefinition = ({
  position,
  rotation = Math.PI / 2,
  radius,
  color = [34 / 255, 211 / 255, 238 / 255, 1],
}: SpawnPointDefinitionOptions): EntityDefinition => ({
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
      {
        primitive: { type: "rectangle", width: 1, height: 1 },
        color,
        localTransform: {
          position: [radius * 0.62, 0],
          scale: [radius, Math.max(3, radius * 0.14)],
        },
      },
    ],
  },
});
