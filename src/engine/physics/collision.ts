import { BoundingBox, BoundingCircle, PhysicsEntity } from "./entity";

export class CollisionDetector {
  detectCollisions(
    entities: PhysicsEntity[],
  ): [PhysicsEntity, PhysicsEntity][] | null {
    const collisions: [PhysicsEntity, PhysicsEntity][] = [];
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

        if (entity.boundingShape.intersects(otherEntity.boundingShape)) {
          collisions.push([entity, otherEntity]);
        }
      }
    }

    return collisions.length > 0 ? collisions : null;
  }
}

export class CollisionResolver {
  private _restitution = 0.6;
  private _penetrationSlop = 0.4;

  resolveCollisions(collisions: [PhysicsEntity, PhysicsEntity][]) {
    for (let i = 0; i < collisions.length; i++) {
      const [entity1, entity2] = collisions[i];

      this._resolveCollision(entity1, entity2);
    }
  }

  private _correctCircleCirclePenetration(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
  ): [number, number] {
    // Sanity check
    if (
      !(
        entity1.boundingShape instanceof BoundingCircle &&
        entity2.boundingShape instanceof BoundingCircle
      )
    ) {
      throw new Error("Sanity check failed: Invalid bounding shape type");
    }

    // Calculate collision normal
    const [x1, y1] = entity1.position;
    const r1 = entity1.boundingShape.radius;

    const [x2, y2] = entity2.position;
    const r2 = entity2.boundingShape.radius;

    const dx = x1 - x2;
    const dy = y1 - y2;

    const distance = Math.sqrt(dx * dx + dy * dy);
    let penetration = r1 + r2 - distance;

    const normal: [number, number] = [dx / distance, dy / distance];

    // Correct Penetration

    // NOTE: Only dynamic entities should be corrected (or else dynamic entities
    // get stuck in kinematic entities)
    if (entity1.type === "dynamic" && entity2.type === "dynamic") {
      penetration = Math.max(penetration - this._penetrationSlop, 0);
    }

    if (entity1.type === "dynamic") {
      entity1.position[0] += normal[0] * penetration;
      entity1.position[1] += normal[1] * penetration;
    }

    if (entity2.type === "dynamic") {
      entity2.position[0] -= normal[0] * penetration;
      entity2.position[1] -= normal[1] * penetration;
    }

    return normal;
  }

  private _correctSquareSquarePenetration(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
  ): [number, number] {
    // Sanity check
    if (
      !(
        entity1.boundingShape instanceof BoundingBox &&
        entity2.boundingShape instanceof BoundingBox
      )
    ) {
      throw new Error("Sanity check failed: Invalid bounding shape type");
    }

    // Calculate collision normal
    const [x1, y1] = entity1.position;
    const [w1, h1] = [
      entity1.boundingShape.width,
      entity1.boundingShape.height,
    ];

    const [x2, y2] = entity2.position;
    const [w2, h2] = [
      entity2.boundingShape.width,
      entity2.boundingShape.height,
    ];

    const dx = x1 - x2;
    const dy = y1 - y2;

    const penetrationX = w1 / 2 + w2 / 2 - Math.abs(dx);
    const penetrationY = h1 / 2 + h2 / 2 - Math.abs(dy);

    let normal: [number, number];
    if (penetrationX < penetrationY) {
      normal = [dx > 0 ? 1 : -1, 0];
    } else {
      normal = [0, dy > 0 ? 1 : -1];
    }

    // Correct Penetration
    let penX = penetrationX;
    let penY = penetrationY;

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

    return normal;
  }

  private _correctPenetration(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
  ): [number, number] {
    if (
      entity1.boundingShape instanceof BoundingBox &&
      entity2.boundingShape instanceof BoundingBox
    ) {
      const normal = this._correctSquareSquarePenetration(entity1, entity2);

      return normal;
    } else if (
      entity1.boundingShape instanceof BoundingCircle &&
      entity2.boundingShape instanceof BoundingCircle
    ) {
      const normal = this._correctCircleCirclePenetration(entity1, entity2);

      return normal;
    } else {
      throw new Error("Missing types in correct penetration implementation");
    }
  }

  private _resolveCollision(entity1: PhysicsEntity, entity2: PhysicsEntity) {
    // Correct penetration and calculate collision normal
    const normal = this._correctPenetration(entity1, entity2);

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
