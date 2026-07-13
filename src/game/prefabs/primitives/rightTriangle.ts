import type { EntityDefinition } from "../../../engine/core/definition";
import type { Vec2 } from "../../../engine/core/transform";
import type { PhysicsEntityType } from "../../../engine/physics/entity";
import type { Color } from "../../../engine/vdu/component";

export interface RightTriangleDefinitionOptions {
  position: Vec2;
  width: number;
  height: number;
  color: Color;
  rotation?: number;
  bodyType?: PhysicsEntityType;
  velocity?: Vec2;
  tags?: string[];
  physical?: boolean;
}

export const rightTriangleDefinition = ({
  position,
  width,
  height,
  color,
  rotation = 0,
  bodyType = "kinematic",
  velocity = [0, 0],
  tags = [],
  physical = true,
}: RightTriangleDefinitionOptions): EntityDefinition => ({
  transform: { position, rotation },
  tags,
  render: {
    parts: [
      {
        primitive: { type: "right-triangle", width: 1, height: 1 },
        color,
        localTransform: {
          position: [0, 0],
          scale: [width, height],
        },
      },
    ],
  },
  physics: physical
    ? {
        type: bodyType,
        velocity,
        collider: {
          type: "polygon",
          vertices: [
            [-width / 2, -height / 2],
            [width / 2, height / 2],
            [-width / 2, height / 2],
          ],
        },
      }
    : undefined,
});
