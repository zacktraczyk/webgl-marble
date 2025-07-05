import { PhysicsEntity } from "../entitySAT";
import { SeparatingAxisTheorem } from "./SeparatingAxisTheorem";

export type Collision = {
  entity1: PhysicsEntity;
  entity2: PhysicsEntity;
  normal: [number, number];
  penetration: number;
  // restitution: number;
  // magAlongNormal: number;
};

export type CollisionPair = [PhysicsEntity, PhysicsEntity];

export class CollisionDetector {
  private readonly _satDetectCollisions =
    SeparatingAxisTheorem.detectCollisions;

  private _generateCollisionEvent(collisionPair: CollisionPair): Collision {
    const [entity1, entity2] = collisionPair;
    const normal: [number, number] = [0, 0];
    const penetration = 0;

    const collisionEvent: Collision = {
      entity1,
      entity2,
      normal,
      penetration,
    };

    return collisionEvent;
  }

  detectCollisions(entities: PhysicsEntity[]): Collision[] | null {
    // TODO: Broad Phase (Sort and Sweep ? AABB ?)

    // Narrow Phase (SAT)
    const collisions = this._satDetectCollisions(entities);
    if (!collisions) {
      return null;
    }

    const collisionEvents: Collision[] = [];
    for (const collisionPair of collisions) {
      collisionEvents.push(this._generateCollisionEvent(collisionPair));
    }

    return collisionEvents;
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
