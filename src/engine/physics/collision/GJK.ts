import type { Collision, CollisionDetector } from ".";
import type { PhysicsEntity } from "../entity";

export class GJKCollisionDetector implements CollisionDetector {
  private _supportFunction(
    entity: PhysicsEntity,
    directionNormal: [number, number]
  ): [number, number] {
    if (!entity.boundingShape) {
      throw new Error("Entity has no bounding shape");
    }

    if (entity.boundingShape.type === "BoundingConvexPolygon") {
      const polygon = entity.boundingShape;
      const vertices = polygon.vertices;
      let maxDot = -Infinity;
      let maxVertex: [number, number] = vertices[0];
      for (const vertex of vertices) {
        const dot =
          vertex[0] * directionNormal[0] + vertex[1] * directionNormal[1];
        if (dot > maxDot) {
          maxDot = dot;
          maxVertex = vertex;
        }
      }
      return maxVertex;
    }

    if (entity.boundingShape.type === "BoundingCircle") {
      const circle = entity.boundingShape;
      return [
        circle.radius * directionNormal[0],
        circle.radius * directionNormal[1],
      ];
    }

    throw new Error("Entity has unsupported bounding shape");
  }

  private _detectCollision(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity
  ): boolean {
    const unnormalizedDirection1: [number, number] = [
      entity2.position[0] - entity1.position[0],
      entity2.position[1] - entity1.position[1],
    ];
    const magnitude = Math.sqrt(
      unnormalizedDirection1[0] ** 2 + unnormalizedDirection1[1] ** 2
    );
    const dir1: [number, number] = [
      unnormalizedDirection1[0] / magnitude,
      unnormalizedDirection1[1] / magnitude,
    ];
    const supportPoint1 = this._supportFunction(entity1, dir1);

    let dir2: [number, number] = [-dir1[0], -dir1[1]];
    const supportPoint2 = this._supportFunction(entity2, dir2);

    let dir3: [number, number] = [dir1[1], -dir1[0]];

    const supportPoint3 = this._supportFunction(entity1, dir3);

    const simplex: [number, number][] = [
      supportPoint1,
      supportPoint2,
      supportPoint3,
    ];

    throw new Error("Not implemented");
  }

  detectCollisions(entities: PhysicsEntity[]): Collision[] | null {
    return null;
  }
}
