import {
  type BoundingConvexPolygon,
  type BoundingCircle,
  PhysicsEntity,
} from "../entitySAT";
import type { CollisionPair } from "./collisionSAT";

export type Line = [[number, number], [number, number]];

namespace SATUtils {
  export function getPolygonEdges(
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

  export function projectPolygonOnAxis(
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

  export function projectCircleOnAxis(
    circle: BoundingCircle,
    position: [number, number],
    axis: [number, number]
  ): [number, number] {
    const [x, y] = position;

    const projection = x * axis[0] + y * axis[1];
    const r = circle.radius;

    return [projection - r, projection + r];
  }
}

export namespace SeparatingAxisTheorem {
  export function polygonPolygonSAT(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity
  ): boolean {
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
    const edges1 = SATUtils.getPolygonEdges(
      entity1.boundingShape,
      entity1.position,
      entity1.rotation
    );
    const edges2 = SATUtils.getPolygonEdges(
      entity2.boundingShape,
      entity2.position,
      entity2.rotation
    );
    const edges = [...edges1, ...edges2];

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

      const proj1 = SATUtils.projectPolygonOnAxis(
        entity1.boundingShape,
        entity1.position,
        entity1.rotation,
        normal
      );
      const proj2 = SATUtils.projectPolygonOnAxis(
        entity2.boundingShape,
        entity2.position,
        entity2.rotation,
        normal
      );

      const [p1min, p1max] = proj1;
      const [p2min, p2max] = proj2;

      // // Check if 2 lines are overlapping
      if (p1min > p2max || p2min > p1max) {
        return false;
      }
    }

    return true;
  }

  export function polygonCircleSAT(
    polygon: PhysicsEntity,
    circle: PhysicsEntity
  ): boolean {
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

    // Find closeset point on polygon to circle
    const entity1Vertices = polygon.boundingShape.vertices;
    let closestPoint = [0, 0];
    let minDistance = Infinity;
    for (let i = 0; i < entity1Vertices.length; i++) {
      const vertex = entity1Vertices[i];
      const rotatedVertex = [
        vertex[0] * Math.cos(polygon.rotation) -
          vertex[1] * Math.sin(polygon.rotation),
        vertex[0] * Math.sin(polygon.rotation) +
          vertex[1] * Math.cos(polygon.rotation),
      ];

      const worldVertex = [
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

    const proj1 = SATUtils.projectPolygonOnAxis(
      polygon.boundingShape,
      polygon.position,
      polygon.rotation,
      axis
    );
    const proj2 = SATUtils.projectCircleOnAxis(
      circle.boundingShape,
      circle.position,
      axis
    );

    const [p1min, p1max] = proj1;
    const [p2min, p2max] = proj2;

    if (p1min > p2max || p2min > p1max) {
      return false;
    }

    const edges = SATUtils.getPolygonEdges(
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
      const proj1 = SATUtils.projectPolygonOnAxis(
        polygon.boundingShape,
        polygon.position,
        polygon.rotation,
        normal
      );
      const proj2 = SATUtils.projectCircleOnAxis(
        circle.boundingShape,
        circle.position,
        normal
      );

      const [p1min, p1max] = proj1;
      const [p2min, p2max] = proj2;

      if (p1min > p2max || p2min > p1max) {
        return false;
      }
    }

    return true;
  }

  export function circleCircleSAT(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity
  ): boolean {
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

    const dx = x1 - x2;
    const dy = y1 - y2;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const sumOfRadii = r1 + r2;

    if (distance <= sumOfRadii) {
      return true;
    }

    return false;
  }

  export function detectCollisions(
    entities: PhysicsEntity[]
  ): CollisionPair[] | null {
    const collisions: CollisionPair[] = [];
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
          const isColliding = polygonPolygonSAT(entity, otherEntity);
          if (isColliding) {
            collisions.push([entity, otherEntity]);
          }
        }

        if (
          entity.boundingShape.type === "BoundingCircle" &&
          otherEntity.boundingShape.type === "BoundingCircle"
        ) {
          const isColliding = circleCircleSAT(entity, otherEntity);
          if (isColliding) {
            collisions.push([entity, otherEntity]);
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
            // Sanity check / typescript validatio
            continue;
          }

          if (
            entityHet.boundingShape.type === "BoundingConvexPolygon" &&
            otherEntityHet.boundingShape.type === "BoundingCircle"
          ) {
            const isColliding = polygonCircleSAT(entityHet, otherEntityHet);
            if (isColliding) {
              collisions.push([entityHet, otherEntityHet]);
            }
          }
        }
      }
    }

    return collisions.length > 0 ? collisions : null;
  }
}
