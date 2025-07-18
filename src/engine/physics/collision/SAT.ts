import type { Collision, CollisionDetector, CollisionResolver, Line } from ".";
import {
  PhysicsEntity,
  type BoundingCircle,
  type BoundingConvexPolygon,
} from "../entity";

export type SATResult =
  | {
      isColliding: false;
      edge: null;
      minimumTranslationVector: null;
    }
  | {
      isColliding: true;
      edge: Line | null; // NOTE: Only for debugging
      minimumTranslationVector: {
        normal: [number, number];
        magnitude: number;
      } | null;
    };

export class SATCollisionDetector implements CollisionDetector {
  private _getPolygonEdges(
    polygon: BoundingConvexPolygon,
    position: [number, number],
    // TODO: Add scale
    rotation: number
  ): Line[] {
    const edges: Line[] = [];
    for (let i = 0; i < polygon.vertices.length; i++) {
      // Transform body vertices to world space
      const bodyVertex1 = polygon.vertices[i];
      const bodyVertex2 = polygon.vertices[(i + 1) % polygon.vertices.length];

      const rotatedBodyVertex1 = [
        bodyVertex1[0] * Math.cos(rotation) -
          bodyVertex1[1] * Math.sin(rotation),
        bodyVertex1[0] * Math.sin(rotation) +
          bodyVertex1[1] * Math.cos(rotation),
      ];

      const rotatedBodyVertex2 = [
        bodyVertex2[0] * Math.cos(rotation) -
          bodyVertex2[1] * Math.sin(rotation),
        bodyVertex2[0] * Math.sin(rotation) +
          bodyVertex2[1] * Math.cos(rotation),
      ];

      const worldVertex1 = [
        rotatedBodyVertex1[0] + position[0],
        rotatedBodyVertex1[1] + position[1],
      ];
      const worldVertex2 = [
        rotatedBodyVertex2[0] + position[0],
        rotatedBodyVertex2[1] + position[1],
      ];

      edges.push([
        [worldVertex1[0], worldVertex1[1]],
        [worldVertex2[0], worldVertex2[1]],
      ]);
    }
    return edges;
  }

  private _projectPolygonOnAxis(
    polygon: BoundingConvexPolygon,
    position: [number, number],
    rotation: number,
    axis: [number, number]
  ): [number, number] {
    let min = Infinity;
    let max = -Infinity;

    for (const vertex of polygon.vertices) {
      const rotatedBodyVertex = [
        vertex[0] * Math.cos(rotation) - vertex[1] * Math.sin(rotation),
        vertex[0] * Math.sin(rotation) + vertex[1] * Math.cos(rotation),
      ];

      const worldVertex = [
        rotatedBodyVertex[0] + position[0],
        rotatedBodyVertex[1] + position[1],
      ];

      const projection = worldVertex[0] * axis[0] + worldVertex[1] * axis[1];
      min = Math.min(min, projection);
      max = Math.max(max, projection);
    }

    return [min, max];
  }

  private _projectCircleOnAxis(
    circle: BoundingCircle,
    position: [number, number],
    axis: [number, number]
  ): [number, number] {
    const [x, y] = position;

    const projection = x * axis[0] + y * axis[1];
    const r = circle.radius;

    return [projection - r, projection + r];
  }

  private _polygonPolygonSAT(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity
  ): SATResult {
    if (!entity1.boundingShape || !entity2.boundingShape) {
      throw new Error("Sanity check failed: Bounding shape is undefined");
    }

    if (
      entity1.boundingShape.type !== "BoundingConvexPolygon" ||
      entity2.boundingShape.type !== "BoundingConvexPolygon"
    ) {
      throw new Error(
        "Sanity check failed: Invalid bounding shape type, both physics entities should be BoundingConvexPolygon"
      );
    }

    // Collect all edges of both polygons
    const edges1 = this._getPolygonEdges(
      entity1.boundingShape,
      entity1.position,
      entity1.rotation
    );
    const edges2 = this._getPolygonEdges(
      entity2.boundingShape,
      entity2.position,
      entity2.rotation
    );
    const edges = [...edges1, ...edges2];

    let smallestOverlap = Infinity;
    let smallestOverlapEdge: Line | null = null; // NOTE: Only for debugging
    let smallestOverlapAxis: [number, number] | null = null;
    for (let i = 0; i < edges.length; i++) {
      if (i < 1) {
        continue;
      }

      const edge = edges[i];
      const [p1, p2] = edge;
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag === 0) {
        continue;
      }

      const normal: [number, number] = [-dy / mag, dx / mag];

      const proj1 = this._projectPolygonOnAxis(
        entity1.boundingShape,
        entity1.position,
        entity1.rotation,
        normal
      );
      const proj2 = this._projectPolygonOnAxis(
        entity2.boundingShape,
        entity2.position,
        entity2.rotation,
        normal
      );

      const [p1min, p1max] = proj1;
      const [p2min, p2max] = proj2;

      // // Check if 2 lines are overlapping
      if (p1min > p2max || p2min > p1max) {
        return {
          isColliding: false,
          edge: null,
          minimumTranslationVector: null,
        };
      }

      const overlap = p1max - p2min;
      if (overlap < smallestOverlap) {
        smallestOverlapEdge = edge;
        smallestOverlap = overlap;
        smallestOverlapAxis = normal;
      }
    }

    if (!smallestOverlapAxis) {
      throw new Error(
        "Sanity check failed: polygon polygon overlap but no smallest overlap axis found"
      );
    }

    return {
      isColliding: true,
      edge: smallestOverlapEdge,
      minimumTranslationVector: {
        normal: smallestOverlapAxis,
        magnitude: smallestOverlap,
      },
    };
  }

  private _polygonCircleSAT(
    polygon: PhysicsEntity,
    circle: PhysicsEntity
  ): SATResult {
    if (!polygon.boundingShape || !circle.boundingShape) {
      throw new Error("Sanity check failed: Bounding shape is undefined");
    }

    if (
      !(
        polygon.boundingShape?.type === "BoundingConvexPolygon" &&
        circle.boundingShape?.type === "BoundingCircle"
      )
    ) {
      throw new Error("Sanity check failed: Invalid bounding shape type");
    }

    let smallestOverlap = Infinity;
    let smallestOverlapEdge: Line | null = null; // NOTE: Only for debugging
    let smallestOverlapAxis: [number, number] | null = null;

    // Find closeset point on polygon to circle
    const entity1Vertices = polygon.boundingShape.vertices;
    let closestPoint: [number, number] = [0, 0];
    let minDistance = Infinity;
    for (let i = 0; i < entity1Vertices.length; i++) {
      const vertex = entity1Vertices[i];
      const rotatedVertex: [number, number] = [
        vertex[0] * Math.cos(polygon.rotation) -
          vertex[1] * Math.sin(polygon.rotation),
        vertex[0] * Math.sin(polygon.rotation) +
          vertex[1] * Math.cos(polygon.rotation),
      ];

      const worldVertex: [number, number] = [
        rotatedVertex[0] + polygon.position[0],
        rotatedVertex[1] + polygon.position[1],
      ];

      const distance = Math.sqrt(
        (worldVertex[0] - circle.position[0]) ** 2 +
          (worldVertex[1] - circle.position[1]) ** 2
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = worldVertex;
      }
    }

    const magnitude = Math.sqrt(closestPoint[0] ** 2 + closestPoint[1] ** 2);
    const axis: [number, number] = [
      closestPoint[0] / magnitude,
      closestPoint[1] / magnitude,
    ];

    const proj1 = this._projectPolygonOnAxis(
      polygon.boundingShape,
      polygon.position,
      polygon.rotation,
      axis
    );
    const proj2 = this._projectCircleOnAxis(
      circle.boundingShape,
      circle.position,
      axis
    );

    const [p1min, p1max] = proj1;
    const [p2min, p2max] = proj2;

    if (p1min > p2max || p2min > p1max) {
      return {
        isColliding: false,
        edge: null,
        minimumTranslationVector: null,
      };
    }

    const overlap = p1max - p2min;
    if (overlap < smallestOverlap) {
      smallestOverlap = overlap;
      smallestOverlapEdge = [closestPoint, closestPoint];
      smallestOverlapAxis = axis;
    }

    const edges = this._getPolygonEdges(
      polygon.boundingShape,
      polygon.position,
      polygon.rotation
    );
    for (let i = 0; i < edges.length; i++) {
      if (i < 1) {
        continue;
      }

      const edge = edges[i];
      const [p1, p2] = edge;
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag === 0) {
        continue;
      }

      const normal: [number, number] = [-dy / mag, dx / mag];
      const proj1 = this._projectPolygonOnAxis(
        polygon.boundingShape,
        polygon.position,
        polygon.rotation,
        normal
      );
      const proj2 = this._projectCircleOnAxis(
        circle.boundingShape,
        circle.position,
        normal
      );

      const [p1min, p1max] = proj1;
      const [p2min, p2max] = proj2;

      if (p1min > p2max || p2min > p1max) {
        return {
          isColliding: false,
          edge: null,
          minimumTranslationVector: null,
        };
      }

      const overlap = p1max - p2min;
      if (overlap < smallestOverlap) {
        smallestOverlap = overlap;
        smallestOverlapEdge = edge;
        smallestOverlapAxis = normal;
      }
    }

    if (!smallestOverlapAxis) {
      throw new Error(
        "Sanity check failed: polygon circle overlap but no smallest overlap axis found"
      );
    }

    return {
      isColliding: true,
      edge: smallestOverlapEdge,
      minimumTranslationVector: {
        normal: smallestOverlapAxis,
        magnitude: smallestOverlap,
      },
    };
  }

  private _circleCircleSAT(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity
  ): SATResult {
    if (
      !(
        entity1.boundingShape?.type === "BoundingCircle" &&
        entity2.boundingShape?.type === "BoundingCircle"
      )
    ) {
      throw new Error("Sanity check failed: Invalid bounding shape type");
    }

    const [x1, y1] = entity1.position;
    const r1 = entity1.boundingShape.radius;

    const [x2, y2] = entity2.position;
    const r2 = entity2.boundingShape.radius;

    const dx = x2 - x1;
    const dy = y2 - y1;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const sumOfRadii = r1 + r2;

    // Calculate normal (direction from entity2 to entity1)
    const normal: [number, number] = [dx / distance, dy / distance];

    if (distance <= sumOfRadii) {
      return {
        isColliding: true,
        edge: null,
        minimumTranslationVector: {
          normal: normal,
          magnitude: sumOfRadii - distance,
        },
      };
    }

    return {
      isColliding: false,
      edge: null,
      minimumTranslationVector: null,
    };
  }

  private _detectCollisions(entities: PhysicsEntity[]): Collision[] | null {
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

        // Homogenous entity collision checks
        if (
          entity.boundingShape.type === "BoundingConvexPolygon" &&
          otherEntity.boundingShape.type === "BoundingConvexPolygon"
        ) {
          const { isColliding, minimumTranslationVector, edge } =
            this._polygonPolygonSAT(entity, otherEntity);
          if (isColliding) {
            if (!minimumTranslationVector) {
              throw new Error(
                "Sanity check failed: polygon polygon overlap but no minimum translation vector found"
              );
            }

            collisions.push({
              entity1: entity,
              entity2: otherEntity,
              edge,
              minimumTranslationVector,
            });
          }
        }

        if (
          entity.boundingShape.type === "BoundingCircle" &&
          otherEntity.boundingShape.type === "BoundingCircle"
        ) {
          const { isColliding, minimumTranslationVector, edge } =
            this._circleCircleSAT(entity, otherEntity);
          if (isColliding) {
            if (!minimumTranslationVector) {
              throw new Error(
                "Sanity check failed: circle circle overlap but no minimum translation vector found"
              );
            }

            collisions.push({
              entity1: entity,
              entity2: otherEntity,
              edge,
              minimumTranslationVector,
            });
          }
        }

        // Heterogenous entity collision checks
        const heterogenousEntityPermutations = [
          [entity, otherEntity],
          [otherEntity, entity],
        ];

        for (const [
          entityHet,
          otherEntityHet,
        ] of heterogenousEntityPermutations) {
          if (!entityHet.boundingShape || !otherEntityHet.boundingShape) {
            // Sanity check / typescript validation
            continue;
          }

          if (
            entityHet.boundingShape.type === "BoundingConvexPolygon" &&
            otherEntityHet.boundingShape.type === "BoundingCircle"
          ) {
            const { isColliding, minimumTranslationVector, edge } =
              this._polygonCircleSAT(entityHet, otherEntityHet);
            if (isColliding) {
              if (!minimumTranslationVector) {
                throw new Error(
                  "Sanity check failed: polygon circle overlap but no minimum translation vector found"
                );
              }

              collisions.push({
                entity1: entityHet,
                entity2: otherEntityHet,
                edge,
                minimumTranslationVector,
              });
            }
          }
        }
      }
    }

    return collisions.length > 0 ? collisions : null;
  }

  detectCollisions(entities: PhysicsEntity[]): Collision[] | null {
    // TODO: Broad Phase (Sort and Sweep ? AABB ?)

    // Narrow Phase (SAT)
    // TODO: Generate contact manifold
    const collisions = this._detectCollisions(entities);
    return collisions;
  }
}

export class SATCollisionResolver implements CollisionResolver {
  private _restitution = 0.9;
  private _penetrationSlop = 0.8;

  resolveCollisions(collisions: Collision[]) {
    for (let i = 0; i < collisions.length; i++) {
      this._resolveCollision(collisions[i]);
    }
  }

  private _resolveCollision(collision: Collision) {
    const { entity1, entity2, minimumTranslationVector } = collision;

    // Correct penetration
    // NOTE: SAT doesn't necessarily give the correct collision normal
    const { normal, magnitude } = minimumTranslationVector;
    let penX = normal[0] * magnitude;
    let penY = normal[1] * magnitude;

    // NOTE: Only dynamic entities should be corrected (or else dynamic entities
    // get stuck in kinematic entities)
    if (entity1.type === "dynamic" && entity2.type === "dynamic") {
      penX = Math.max(penX - this._penetrationSlop, 0);
      penY = Math.max(penY - this._penetrationSlop, 0);
    }

    if (entity1.type === "dynamic") {
      entity1.position[0] += normal[0] * penX;
      entity1.position[1] += normal[1] * penY;
    }

    if (entity2.type === "dynamic") {
      entity2.position[0] -= normal[0] * penX;
      entity2.position[1] -= normal[1] * penY;
    }

    // Calculate relative velocity
    const relativeVelocity = [
      entity1.velocity[0] - entity2.velocity[0],
      entity1.velocity[1] - entity2.velocity[1],
    ];

    // Calculate relative velocity in terms of the normal direction
    const relativeNormalVelocity =
      relativeVelocity[0] * normal[0] + relativeVelocity[1] * normal[1];

    // Calculate impulse magnitude
    if (entity1.type === "dynamic") {
      entity1.velocity[0] -=
        normal[0] * relativeNormalVelocity * this._restitution;
      entity1.velocity[1] -=
        normal[1] * relativeNormalVelocity * this._restitution;
    } else {
      entity2.velocity[0] +=
        normal[0] * relativeNormalVelocity * this._restitution;
      entity2.velocity[1] +=
        normal[1] * relativeNormalVelocity * this._restitution;
    }

    if (entity2.type === "dynamic") {
      entity2.velocity[0] +=
        normal[0] * relativeNormalVelocity * this._restitution;
      entity2.velocity[1] +=
        normal[1] * relativeNormalVelocity * this._restitution;
    } else {
      entity1.velocity[0] -=
        normal[0] * relativeNormalVelocity * this._restitution;
      entity1.velocity[1] -=
        normal[1] * relativeNormalVelocity * this._restitution;
    }
  }
}
