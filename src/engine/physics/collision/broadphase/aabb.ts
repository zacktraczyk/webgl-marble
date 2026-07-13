import type { PhysicsEntity } from "../../entity";

export type Aabb = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Computes a body's world-space axis-aligned bounding box. */
export const computeWorldAabb = (entity: PhysicsEntity): Aabb | null => {
  const shape = entity.boundingShape;
  if (!shape) {
    return null;
  }

  if (shape.type === "BoundingCircle") {
    return {
      minX: entity.position[0] - shape.radius,
      minY: entity.position[1] - shape.radius,
      maxX: entity.position[0] + shape.radius,
      maxY: entity.position[1] + shape.radius,
    };
  }

  const cosine = Math.cos(entity.rotation);
  const sine = Math.sin(entity.rotation);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of shape.vertices) {
    const worldX = x * cosine - y * sine + entity.position[0];
    const worldY = x * sine + y * cosine + entity.position[1];
    minX = Math.min(minX, worldX);
    minY = Math.min(minY, worldY);
    maxX = Math.max(maxX, worldX);
    maxY = Math.max(maxY, worldY);
  }
  return { minX, minY, maxX, maxY };
};

export const aabbsOverlap = (a: Aabb, b: Aabb) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
