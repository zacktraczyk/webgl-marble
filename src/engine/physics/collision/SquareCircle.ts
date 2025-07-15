// NOTE: Square Circle Collision Detection is completely broken in refactor :/

import type { Collision, CollisionDetector, CollisionResolver } from "./";
import {
  PhysicsEntity,
  type BoundingCircle,
  type BoundingConvexPolygon,
} from "../entity";

type BoundingSquare = [[number, number], [number, number]];

type SquareCircleCollisionResult =
  | {
      isColliding: false;
      minimumTranslationVector: null;
    }
  | {
      isColliding: true;
      minimumTranslationVector: {
        normal: [number, number];
        magnitude: number;
      } | null;
    };

export class SquareCircleCollisionDetector implements CollisionDetector {
  /**
   * Construct a bounding Square around the vertices of a BoundingConvexPolygon
   * @param polygon a BoundingConvexPolygon
   * @returns bounding square constructed of bottom left and top right points
   * i.e. [[minX, minY], [maxX, maxY]]
   */
  _constructBoundingSquare(polygon: BoundingConvexPolygon): BoundingSquare {
    let boundingSquare: BoundingSquare = [
      [-Infinity, -Infinity],
      [Infinity, Infinity],
    ];
    for (let i = 0; i < polygon.vertices.length; i++) {
      const vert = polygon.vertices[i];
      let [bodyX, bodyY] = vert;

      let worldX = polygon.position[0] + bodyX;
      let worldY = polygon.position[1] + bodyY;

      boundingSquare[0][0] = Math.min(worldX, boundingSquare[0][0]);
      boundingSquare[0][1] = Math.min(worldY, boundingSquare[0][1]);

      boundingSquare[1][0] = Math.max(worldX, boundingSquare[1][0]);
      boundingSquare[1][1] = Math.max(worldY, boundingSquare[1][1]);
    }

    return boundingSquare;
  }

  _squareSquareCheck(
    poly1: BoundingConvexPolygon,
    poly2: BoundingConvexPolygon
  ) {
    const square1 = this._constructBoundingSquare(poly1);
    const square2 = this._constructBoundingSquare(poly2);

    const isSquareIntersect =
      square1[0][0] <= square2[1][0] &&
      square1[1][0] >= square2[0][0] &&
      square1[0][1] <= square2[1][1] &&
      square1[1][1] >= square2[0][1];

    if (!isSquareIntersect) {
      return {
        isColliding: false,
        minimumTranslationVector: null,
      };
    }

    // Calculate collision normal
    const [x1, y1] = poly1.position;
    const w1 = square1[1][0] - square1[0][0];
    const h1 = square1[1][1] - square1[0][1];

    const [x2, y2] = poly2.position;
    const w2 = square2[1][0] - square2[0][0];
    const h2 = square2[1][1] - square2[0][1];

    const dx = x1 - x2;
    const dy = y1 - y2;

    const penetrationX = w1 / 2 + w2 / 2 - Math.abs(dx);
    const penetrationY = h1 / 2 + h2 / 2 - Math.abs(dy);

    let normal: [number, number];
    let magnitude: number;
    if (penetrationX < penetrationY) {
      normal = [dx > 0 ? 1 : -1, 0];
      magnitude = penetrationX;
    } else {
      normal = [0, dy > 0 ? 1 : -1];
      magnitude = penetrationY;
    }

    const collision: SquareCircleCollisionResult = {
      isColliding: true,
      minimumTranslationVector: {
        normal: normal,
        magnitude: magnitude,
      },
    };

    return collision;
  }

  _circleSquareCheck(circle: BoundingCircle, poly: BoundingConvexPolygon) {
    const square = this._constructBoundingSquare(poly);
    const w2 = square[1][0] - square[0][0];
    const h2 = square[1][1] - square[0][1];

    const dx = circle.position[0] - poly.position[0];
    const dy = circle.position[1] - poly.position[1];

    const isSquareCircleIntersect =
      dx <= w2 / 2 && dx >= -w2 / 2 && dy <= h2 / 2 && dy >= -h2 / 2;

    // const isSquareCircleIntersect =
    //   square[0][0] <= circle.position[0] + circle.radius &&
    //   square[1][0] >= circle.position[0] - circle.radius &&
    //   square[0][1] <= circle.position[1] + circle.radius &&
    //   square[1][1] >= circle.position[1] - circle.radius;

    if (!isSquareCircleIntersect) {
      return {
        isColliding: false,
        minimumTranslationVector: null,
      };
    }

    // Calculate collision normal
    const r1 = circle.radius;

    const penetrationX = r1 + w2 / 2 - Math.abs(dx);
    const penetrationY = r1 + h2 / 2 - Math.abs(dy);

    let normal: [number, number];
    let magnitude: number;
    if (penetrationX < penetrationY) {
      normal = [dx > 0 ? 1 : -1, 0];
      magnitude = penetrationX;
    } else {
      normal = [0, dy > 0 ? 1 : -1];
      magnitude = penetrationY;
    }

    const collision: SquareCircleCollisionResult = {
      isColliding: true,
      minimumTranslationVector: {
        normal: normal,
        magnitude: magnitude,
      },
    };

    return collision;
  }

  _circleCircleCheck(circle1: BoundingCircle, circle2: BoundingCircle) {
    const dx = circle1.position[0] - circle2.position[0];
    const dy = circle1.position[1] - circle2.position[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radiusSum = circle1.radius + circle2.radius;

    const isCircleCircleIntersect = distance <= radiusSum;

    if (!isCircleCircleIntersect) {
      return {
        isColliding: false,
        minimumTranslationVector: null,
      };
    }

    // Calculate collision normal
    let penetration = radiusSum - distance;
    const normal: [number, number] = [dx / distance, dy / distance];

    const collision: SquareCircleCollisionResult = {
      isColliding: true,
      minimumTranslationVector: {
        normal: normal,
        magnitude: penetration,
      },
    };

    return collision;
  }

  _detectCollision(entity1: PhysicsEntity, entity2: PhysicsEntity) {
    if (!entity1.boundingShape || !entity2.boundingShape) {
      throw new Error("Cannot detect collision: Invalid bounding shape type");
    }

    if (
      entity1.boundingShape.type === "BoundingCircle" &&
      entity2.boundingShape.type === "BoundingCircle"
    ) {
      return this._circleCircleCheck(
        entity1.boundingShape,
        entity2.boundingShape
      );
    }

    if (
      entity1.boundingShape.type === "BoundingCircle" &&
      entity2.boundingShape.type === "BoundingConvexPolygon"
    ) {
      return this._circleSquareCheck(
        entity1.boundingShape,
        entity2.boundingShape
      );
    }

    if (
      entity1.boundingShape.type === "BoundingConvexPolygon" &&
      entity2.boundingShape.type === "BoundingCircle"
    ) {
      return this._circleSquareCheck(
        entity2.boundingShape,
        entity1.boundingShape
      );
    }

    if (
      entity1.boundingShape.type === "BoundingConvexPolygon" &&
      entity2.boundingShape.type === "BoundingConvexPolygon"
    ) {
      return this._squareSquareCheck(
        entity1.boundingShape,
        entity2.boundingShape
      );
    }

    throw new Error("Cannot detect collision: Invalid bounding shape type");
  }

  detectCollisions(entities: PhysicsEntity[]): Collision[] | null {
    const collisions: Collision[] = [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity.boundingShape) {
        continue;
      }

      for (let j = i + 1; j < entities.length; j++) {
        const otherEntity = entities[j];
        if (!otherEntity.boundingShape) {
          continue;
        }

        const collisionResult = this._detectCollision(entity, otherEntity);
        if (collisionResult.isColliding) {
          if (!collisionResult.minimumTranslationVector) {
            throw new Error(
              "Collision result is colliding, but has no minimum translation vector"
            );
          }

          collisions.push({
            entity1: entity,
            entity2: otherEntity,
            edge: null,
            minimumTranslationVector: collisionResult.minimumTranslationVector,
          });
        }
      }
    }

    return collisions.length > 0 ? collisions : null;
  }
}

export class SquareCircleCollisionResolver implements CollisionResolver {
  private _restitution = 0.6;
  private _penetrationSlop = 0.8;

  resolveCollisions(collisions: Collision[]) {
    for (let i = 0; i < collisions.length; i++) {
      const collision = collisions[i];

      this._resolveCollision(collision);
    }
  }

  private _correctPenetration(collision: Collision): [number, number] {
    const {
      entity1,
      entity2,
      minimumTranslationVector: { normal, magnitude },
    } = collision;

    const penetration = magnitude - this._penetrationSlop;

    if (entity1.type === "dynamic") {
      entity1.position[0] += normal[0] * penetration;
      entity1.position[1] += normal[1] * penetration;
    } else if (entity2.type === "dynamic") {
      entity2.position[0] -= normal[0] * penetration;
      entity2.position[1] -= normal[1] * penetration;
    }

    if (entity2.type === "dynamic") {
      entity2.position[0] -= normal[0] * penetration;
      entity2.position[1] -= normal[1] * penetration;
    } else if (entity1.type === "dynamic") {
      entity1.position[0] += normal[0] * penetration;
      entity1.position[1] += normal[1] * penetration;
    }

    return normal;
  }

  private _resolveCollision(collision: Collision) {
    const { entity1, entity2 } = collision;

    // Correct penetration and calculate collision normal
    const normal = this._correctPenetration(collision);

    // Calculate relative velocity
    const relativeVelocity = [
      entity1.velocity[0] - entity2.velocity[0],
      entity1.velocity[1] - entity2.velocity[1],
    ];

    // Calculate relative velocity in terms of the normal direction
    const magAlongNormal =
      relativeVelocity[0] * normal[0] + relativeVelocity[1] * normal[1];

    // Calculate impulse magnitude
    if (entity1.type === "dynamic") {
      entity1.velocity[0] -= normal[0] * magAlongNormal * this._restitution;
      entity1.velocity[1] -= normal[1] * magAlongNormal * this._restitution;
    } else {
      entity2.velocity[0] += normal[0] * magAlongNormal * this._restitution;
      entity2.velocity[1] += normal[1] * magAlongNormal * this._restitution;
    }

    if (entity2.type === "dynamic") {
      entity2.velocity[0] += normal[0] * magAlongNormal * this._restitution;
      entity2.velocity[1] += normal[1] * magAlongNormal * this._restitution;
    } else {
      entity1.velocity[0] -= normal[0] * magAlongNormal * this._restitution;
      entity1.velocity[1] -= normal[1] * magAlongNormal * this._restitution;
    }
  }
}
