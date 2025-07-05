import {
  PhysicsEntity,
  type BoundingCircle,
  type BoundingConvexPolygon,
} from "./entitySAT";
import type { DebugSATData } from "./physicsSAT";

export type Collision = {
  entity1: PhysicsEntity;
  entity2: PhysicsEntity;
  normal: [number, number];
  penetration: number;
  // restitution: number;
  // magAlongNormal: number;
};

export type Line = [[number, number], [number, number]];

// TODO: Separating Axis Theorem Collision Detection

export class CollisionDetector {
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
      const slope = normal[1] / normal[0];

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
        return false;
      }
    }

    return true;
  }

  private _polygonCircleSAT(
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
      return false;
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
      const slope = normal[1] / normal[0];

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

      // // Check if 2 lines are overlapping
      if (p1min > p2max || p2min > p1max) {
        return false;
      }
    }

    return true;
  }

  private _circleCircleSAT(
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

        if (
          entity.boundingShape.type === "BoundingConvexPolygon" &&
          otherEntity.boundingShape.type === "BoundingConvexPolygon"
        ) {
          const isColliding = this._polygonPolygonSAT(entity, otherEntity);
          if (isColliding) {
            const collision: Collision = {
              entity1: entity,
              entity2: otherEntity,
              // TODO: Fix penetration and normal
              normal: [0, 0],
              penetration: 0,
            };
            collisions.push(collision);
          }
        }

        if (
          entity.boundingShape.type === "BoundingConvexPolygon" &&
          otherEntity.boundingShape.type === "BoundingCircle"
        ) {
          const isColliding = this._polygonCircleSAT(entity, otherEntity);
          if (isColliding) {
            const collision: Collision = {
              entity1: entity,
              entity2: otherEntity,
              // TODO: Fix penetration and normal
              normal: [0, 0],
              penetration: 0,
            };
            collisions.push(collision);
          }
        }

        if (
          entity.boundingShape.type === "BoundingCircle" &&
          otherEntity.boundingShape.type === "BoundingConvexPolygon"
        ) {
          const isColliding = this._polygonCircleSAT(otherEntity, entity);
          if (isColliding) {
            const collision: Collision = {
              entity1: entity,
              entity2: otherEntity,
              // TODO: Fix penetration and normal
              normal: [0, 0],
              penetration: 0,
            };
            collisions.push(collision);
          }
        }

        if (
          entity.boundingShape.type === "BoundingCircle" &&
          otherEntity.boundingShape.type === "BoundingCircle"
        ) {
          const isColliding = this._circleCircleSAT(entity, otherEntity);
          if (isColliding) {
            const collision: Collision = {
              entity1: entity,
              entity2: otherEntity,
              // TODO: Fix penetration and normal
              normal: [0, 0],
              penetration: 0,
            };
            collisions.push(collision);
          }
        }
      }
    }

    return collisions.length > 0 ? collisions : null;
  }
}

export class CollisionResolver {
  private _restitution = 0.6;
  private _penetrationSlop = 0.8;

  resolveCollisions(collisions: Collision[]) {
    for (let i = 0; i < collisions.length; i++) {
      this._resolveCollision(collisions[i]);
    }
  }

  // private _correctCircleCirclePenetration(
  //   entity1: PhysicsEntity,
  //   entity2: PhysicsEntity
  // ): [number, number] {
  //   // Sanity check
  //   if (
  //     !(
  //       entity1.boundingShape?.type === "BoundingCircle" &&
  //       entity2.boundingShape?.type === "BoundingCircle"
  //     )
  //   ) {
  //     throw new Error("Sanity check failed: Invalid bounding shape type");
  //   }

  //   // Calculate collision normal
  //   const [x1, y1] = entity1.position;
  //   const r1 = entity1.boundingShape.radius;

  //   const [x2, y2] = entity2.position;
  //   const r2 = entity2.boundingShape.radius;

  //   const dx = x1 - x2;
  //   const dy = y1 - y2;

  //   const distance = Math.sqrt(dx * dx + dy * dy);
  //   let penetration = r1 + r2 - distance;

  //   const normal: [number, number] = [dx / distance, dy / distance];

  //   // Correct Penetration

  //   // NOTE: Only dynamic entities should be corrected (or else dynamic entities
  //   // get stuck in kinematic entities)
  //   if (entity1.type === "dynamic" && entity2.type === "dynamic") {
  //     penetration = Math.max(penetration - this._penetrationSlop, 0);
  //   }

  //   if (entity1.type === "dynamic") {
  //     entity1.position[0] += normal[0] * penetration;
  //     entity1.position[1] += normal[1] * penetration;
  //   }

  //   if (entity2.type === "dynamic") {
  //     entity2.position[0] -= normal[0] * penetration;
  //     entity2.position[1] -= normal[1] * penetration;
  //   }

  //   return normal;
  // }

  // private _correctSquareSquarePenetration(
  //   entity1: PhysicsEntity,
  //   entity2: PhysicsEntity
  // ): [number, number] {
  //   // Sanity check
  //   if (
  //     !(
  //       entity1.boundingShape?.type === "BoundingBox" &&
  //       entity2.boundingShape?.type === "BoundingBox"
  //     )
  //   ) {
  //     throw new Error("Sanity check failed: Invalid bounding shape type");
  //   }

  //   // Calculate collision normal
  //   const [x1, y1] = entity1.position;
  //   const [w1, h1] = [
  //     entity1.boundingShape.width,
  //     entity1.boundingShape.height,
  //   ];

  //   const [x2, y2] = entity2.position;
  //   const [w2, h2] = [
  //     entity2.boundingShape.width,
  //     entity2.boundingShape.height,
  //   ];

  //   const dx = x1 - x2;
  //   const dy = y1 - y2;

  //   const penetrationX = w1 / 2 + w2 / 2 - Math.abs(dx);
  //   const penetrationY = h1 / 2 + h2 / 2 - Math.abs(dy);

  //   let normal: [number, number];
  //   if (penetrationX < penetrationY) {
  //     normal = [dx > 0 ? 1 : -1, 0];
  //   } else {
  //     normal = [0, dy > 0 ? 1 : -1];
  //   }

  //   // Correct Penetration
  //   let penX = penetrationX;
  //   let penY = penetrationY;

  //   // NOTE: Only dynamic entities should be corrected (or else dynamic entities
  //   // get stuck in kinematic entities)
  //   if (entity1.type === "dynamic" && entity2.type === "dynamic") {
  //     penX = Math.max(penX - this._penetrationSlop, 0);
  //     penY = Math.max(penY - this._penetrationSlop, 0);
  //   }

  //   if (entity1.type === "dynamic") {
  //     entity1.position[0] += normal[0] * penX;
  //     entity1.position[1] += normal[1] * penY;
  //   }

  //   if (entity2.type === "dynamic") {
  //     entity2.position[0] -= normal[0] * penX;
  //     entity2.position[1] -= normal[1] * penY;
  //   }

  //   return normal;
  // }

  // private _correctCircleSquarePenetration(
  //   entity1: PhysicsEntity,
  //   entity2: PhysicsEntity
  // ): [number, number] {
  //   // Sanity check
  //   if (
  //     !(
  //       entity1.boundingShape instanceof BoundingCircle &&
  //       entity2.boundingShape instanceof BoundingBox
  //     )
  //   ) {
  //     throw new Error("Sanity check failed: Invalid bounding shape type");
  //   }

  //   // Calculate collision normal
  //   const [x1, y1] = entity1.position;
  //   const r1 = entity1.boundingShape.radius;

  //   const [x2, y2] = entity2.position;
  //   const [w2, h2] = [
  //     entity2.boundingShape.width,
  //     entity2.boundingShape.height,
  //   ];

  //   const dx = x1 - x2;
  //   const dy = y1 - y2;

  //   const penetrationX = r1 + w2 / 2 - Math.abs(dx);
  //   const penetrationY = r1 + h2 / 2 - Math.abs(dy);

  //   let normal: [number, number];
  //   if (penetrationX < penetrationY) {
  //     normal = [dx > 0 ? 1 : -1, 0];
  //   } else {
  //     normal = [0, dy > 0 ? 1 : -1];
  //   }

  //   // Correct Penetration
  //   let penX = penetrationX;
  //   let penY = penetrationY;

  //   // NOTE: Only dynamic entities should be corrected (or else dynamic entities
  //   // get stuck in kinematic entities)
  //   if (entity1.type === "dynamic" && entity2.type === "dynamic") {
  //     penX = Math.max(penX - this._penetrationSlop, 0);
  //     penY = Math.max(penY - this._penetrationSlop, 0);
  //   }

  //   if (entity1.type === "dynamic") {
  //     entity1.position[0] += normal[0] * penX;
  //     entity1.position[1] += normal[1] * penY;
  //   }

  //   if (entity2.type === "dynamic") {
  //     entity2.position[0] -= normal[0] * penX;
  //     entity2.position[1] -= normal[1] * penY;
  //   }

  //   return normal;
  // }

  // private _correctPenetration(
  //   entity1: PhysicsEntity,
  //   entity2: PhysicsEntity
  // ): [number, number] {
  //   if (
  //     entity1.boundingShape instanceof BoundingBox &&
  //     entity2.boundingShape instanceof BoundingBox
  //   ) {
  //     const normal = this._correctSquareSquarePenetration(entity1, entity2);

  //     return normal;
  //   } else if (
  //     entity1.boundingShape instanceof BoundingCircle &&
  //     entity2.boundingShape instanceof BoundingCircle
  //   ) {
  //     const normal = this._correctCircleCirclePenetration(entity1, entity2);

  //     return normal;
  //   } else if (
  //     entity1.boundingShape instanceof BoundingBox &&
  //     entity2.boundingShape instanceof BoundingCircle
  //   ) {
  //     const normal = this._correctCircleSquarePenetration(entity2, entity1);

  //     return [-normal[0], -normal[1]];
  //   } else if (
  //     entity1.boundingShape instanceof BoundingCircle &&
  //     entity2.boundingShape instanceof BoundingBox
  //   ) {
  //     const normal = this._correctCircleSquarePenetration(entity1, entity2);

  //     return normal;
  //   } else {
  //     throw new Error("Missing types in correct penetration implementation");
  //   }
  // }

  private _resolveCollision(collision: Collision) {
    const { entity1, entity2 } = collision;

    // Correct penetration and calculate collision normal
    // const normal = this._correctPenetration(entity1, entity2);

    // Calculate relative velocity
    // const relativeVelocity = [
    //   entity1.velocity[0] - entity2.velocity[0],
    //   entity1.velocity[1] - entity2.velocity[1],
    // ];

    // Calculate relative velocity in terms of the normal direction
    // const magAlongNormal =
    //   relativeVelocity[0] * normal[0] + relativeVelocity[1] * normal[1];

    // Calculate impulse magnitude
    // if (entity1.type === "dynamic") {
    //   entity1.velocity[0] -= normal[0] * magAlongNormal * this._restitution;
    //   entity1.velocity[1] -= normal[1] * magAlongNormal * this._restitution;
    // } else {
    //   entity2.velocity[0] += normal[0] * magAlongNormal * this._restitution;
    //   entity2.velocity[1] += normal[1] * magAlongNormal * this._restitution;
    // }

    // if (entity2.type === "dynamic") {
    //   entity2.velocity[0] += normal[0] * magAlongNormal * this._restitution;
    //   entity2.velocity[1] += normal[1] * magAlongNormal * this._restitution;
    // } else {
    //   entity1.velocity[0] -= normal[0] * magAlongNormal * this._restitution;
    //   entity1.velocity[1] -= normal[1] * magAlongNormal * this._restitution;
    // }
  }
}
