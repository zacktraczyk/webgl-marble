import type { Collision, CollisionDetector } from ".";
import { Observer } from "../../utils/Observer";
import type { PhysicsEntity } from "../entity";

export class GJKCollisionDetector implements CollisionDetector {
  private _findFartherstPoint(
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
        const [bodyX, bodyY] = vertex;

        const rotation = entity.rotation;
        const rotatedBodyVertex = [
          bodyX * Math.cos(rotation) - bodyY * Math.sin(rotation),
          bodyX * Math.sin(rotation) + bodyY * Math.cos(rotation),
        ];

        const position = entity.position;
        const worldVertex: [number, number] = [
          rotatedBodyVertex[0] + position[0],
          rotatedBodyVertex[1] + position[1],
        ];

        const dot =
          worldVertex[0] * directionNormal[0] +
          worldVertex[1] * directionNormal[1];
        if (dot > maxDot) {
          maxDot = dot;
          maxVertex = worldVertex;
        }
      }
      return maxVertex;
    }

    if (entity.boundingShape.type === "BoundingCircle") {
      const circle = entity.boundingShape;
      const [bodyX, bodyY] = entity.position;

      const position = entity.position;
      const worldPosition: [number, number] = [
        bodyX + position[0],
        bodyY + position[1],
      ];

      return [
        worldPosition[0] + circle.radius * directionNormal[0],
        worldPosition[1] + circle.radius * directionNormal[1],
      ];
    }

    throw new Error("Entity has unsupported bounding shape");
  }

  private _supportPoint(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
    directionNormal: [number, number]
  ): [number, number] {
    const oppositeDirectionNormal: [number, number] = [
      -directionNormal[0],
      -directionNormal[1],
    ];

    const furthestPoint1 = this._findFartherstPoint(entity1, directionNormal);
    const furthestPoint2 = this._findFartherstPoint(
      entity2,
      oppositeDirectionNormal
    );

    this._debug({
      furthestPoint1,
      furthestPoint2,
    });

    const supportPoint: [number, number] = [
      furthestPoint1[0] - furthestPoint2[0],
      furthestPoint1[1] - furthestPoint2[1],
    ];

    this._debug({
      supportPointDirection: directionNormal,
      supportPoint,
    });

    return supportPoint;
  }

  private _sameDirection(
    direction1: [number, number],
    direction2: [number, number]
  ): boolean {
    return direction1[0] * direction2[0] + direction1[1] * direction2[1] > 0;
  }

  private _tripleProduct(
    a: [number, number],
    b: [number, number],
    c: [number, number]
  ): [number, number] {
    const aCrossB = a[0] * b[1] - a[1] * b[0];
    return [-aCrossB * c[1], aCrossB * c[0]];
  }

  private _getDirectionUnitVector(
    point1: [number, number],
    point2: [number, number]
  ): [number, number] {
    const direction = [point2[0] - point1[0], point2[1] - point1[1]];
    const magnitude = Math.sqrt(direction[0] ** 2 + direction[1] ** 2);
    return [direction[0] / magnitude, direction[1] / magnitude];
  }

  private _lineSimplex(simplex: [[number, number], [number, number]]): {
    direction: [number, number];
    simplex: [[number, number], [number, number]] | [[number, number]];
    isColliding: boolean;
  } {
    // TODO: Origin is on line
    const A = simplex[0];
    const B = simplex[1];

    const AO = this._getDirectionUnitVector(A, [0, 0]);
    const AB = this._getDirectionUnitVector(A, B);

    if (this._sameDirection(AB, AO)) {
      // NOTE: This is the direction perpendicular to the plane of the simplex
      // pointing in the direction of the origin
      const ABPerp = this._tripleProduct(AB, AO, AB);

      const newDirectionMagnitude = Math.sqrt(ABPerp[0] ** 2 + ABPerp[1] ** 2);
      const newDirectionUnitVector: [number, number] = [
        ABPerp[0] / newDirectionMagnitude,
        ABPerp[1] / newDirectionMagnitude,
      ];

      const newSimplex: [[number, number], [number, number]] = [A, B];

      return {
        direction: newDirectionUnitVector,
        simplex: newSimplex,
        isColliding: false,
      };
    } else {
      const newSimplex: [[number, number]] = [A];

      return {
        direction: AO,
        simplex: newSimplex,
        isColliding: false,
      };
    }
  }

  private _triangleSimplex(
    simplex: [[number, number], [number, number], [number, number]],
    direction: [number, number]
  ): {
    simplex: [number, number][];
    direction: [number, number];
    isColliding: boolean;
  } {
    // TODO: Origin is on triangle

    // TODO: Fix this. Triangles come out as lines (repeated 1st and 3rd vertices)

    const C = simplex[0];
    const B = simplex[1];
    const A = simplex[2];

    const AB = this._getDirectionUnitVector(A, B);
    const AC = this._getDirectionUnitVector(A, C);
    const AO = this._getDirectionUnitVector(A, [0, 0]);

    const ABperp = this._tripleProduct(AC, AB, AB);
    const ACperp = this._tripleProduct(AB, AC, AC);

    if (this._sameDirection(ABperp, AO)) {
      const newSimplex = [B, A];

      const newDirectionMagnitude = Math.sqrt(ABperp[0] ** 2 + ABperp[1] ** 2);
      const newDirectionUnitVector: [number, number] = [
        ABperp[0] / newDirectionMagnitude,
        ABperp[1] / newDirectionMagnitude,
      ];

      return {
        simplex: newSimplex,
        direction: newDirectionUnitVector,
        isColliding: false,
      };
    } else if (this._sameDirection(ACperp, AO)) {
      const newSimplex = [B, C];

      const newDirectionMagnitude = Math.sqrt(ACperp[0] ** 2 + ACperp[1] ** 2);
      const newDirectionUnitVector: [number, number] = [
        ACperp[0] / newDirectionMagnitude,
        ACperp[1] / newDirectionMagnitude,
      ];

      return {
        simplex: newSimplex,
        direction: newDirectionUnitVector,
        isColliding: false,
      };
    }

    return { simplex, direction, isColliding: true };
  }

  /**
   * Given a simplex and a direction, find the next point in the simplex
   * and update the direction to the next direction.
   *
   * @param simplex The simplex to check (updated in place)
   * @param direction The direction to check (updated in place)
   * @returns True if the simplex is colliding, false otherwise
   */
  private _handleSimplex(
    simplex: [number, number][],
    direction: [number, number]
  ): {
    simplex: [number, number][];
    direction: [number, number];
    isColliding: boolean;
  } {
    switch (simplex.length) {
      case 2:
        return this._lineSimplex(
          simplex as [[number, number], [number, number]]
        );
      case 3:
        const triangleSimplex = simplex as [
          [number, number],
          [number, number],
          [number, number],
        ];
        return this._triangleSimplex(triangleSimplex, direction);
      default:
        throw new Error("Simplex has too many points");
    }
  }

  private _detectCollision(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity
  ): boolean {
    // Support point 1
    const initialDirection = this._getDirectionUnitVector(
      entity2.position,
      entity1.position
    );
    const supportPoint1 = this._supportPoint(
      entity1,
      entity2,
      initialDirection
    );

    // Create initial simplex
    let simplex: [number, number][] = [];
    simplex.push(supportPoint1);

    // Support point 2
    let direction = this._getDirectionUnitVector(supportPoint1, [0, 0]);

    while (true) {
      const supportPoint = this._supportPoint(entity1, entity2, direction);

      if (!this._sameDirection(direction, supportPoint)) {
        this._debug({
          sameDirectionSupportPoint: true,
          direction,
          supportPoint,
        });
        return false; // No collision
      }

      simplex.push(supportPoint);

      this._debug({
        inconclusiveSimplex: true,
        simplex,
        direction,
      });

      const {
        isColliding,
        simplex: newSimplex,
        direction: newDirection,
      } = this._handleSimplex(simplex, direction);
      if (isColliding) {
        // console.log("isColliding", newSimplex, newDirection);
        this._debug({
          isColliding: true,
          simplex,
          direction,
        });
        return true;
      }

      // TODO: Remove this; sanity check
      if (
        direction[0] === newDirection?.[0] &&
        direction[1] === newDirection?.[1]
      ) {
        console.error("Direction is not updated", {
          direction,
          newDirection,
        });
        debugger;
      }

      if (newSimplex) {
        simplex = newSimplex;
      }
      if (newDirection) {
        direction = newDirection;
      }
    }
  }

  detectCollisions(entities: PhysicsEntity[]): Collision[] | null {
    const collisions: Collision[] = [];
    const activeEntities = entities;
    for (let i = 0; i < activeEntities.length; i++) {
      const entity = activeEntities[i];
      if (!entity.boundingShape) {
        continue;
      }

      for (let j = i + 1; j < activeEntities.length; j++) {
        const otherEntity = activeEntities[j];
        if (!otherEntity.boundingShape) {
          continue;
        }

        const isColliding = this._detectCollision(entity, otherEntity);
        if (isColliding) {
          collisions.push({
            entity1: entity,
            entity2: otherEntity,
            // TODO: Edge
            edge: null,
            // TODO: MTV
            minimumTranslationVector: {
              normal: [0, 0],
              magnitude: 0,
            },
          });
        }
      }
    }

    return collisions.length > 0 ? collisions : null;
  }

  addDebugObserver(observer: (data: any) => void) {
    this._debug_observer.register(observer);
  }

  removeDebugObserver(observer: (data: any) => void) {
    this._debug_observer.unregister(observer);
  }

  clearDebugObservers() {
    this._debug_observer.clear();
  }

  private _debug_observer: Observer<any> = new Observer<any>();
  private _debug(data: any) {
    this._debug_observer.notify(data);
  }
}
