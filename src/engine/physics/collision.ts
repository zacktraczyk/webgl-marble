import { BoundingBox, BoundingCircle, PhysicsEntity } from "./entity";

export type Collision = {
  entity1: PhysicsEntity;
  entity2: PhysicsEntity;

  contactNormal: [number, number]; // Normal of collision
  overlap: number; // Penetration depth
};

export class CollisionDetector {
  collectBroadCollisionPairs(
    entities: PhysicsEntity[],
  ): [PhysicsEntity, PhysicsEntity][] | null {
    // TODO: use tree of axis-aligned bounding boxes for broad phase collision
    // detection
    // TODO: Expand boxes by a distance of k * delta_t to account for potential
    // acclerations
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

  private _generateCircleCircleCollision(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
  ): Collision {
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

    const contactNormal: [number, number] = [dx / distance, dy / distance];
    const overlap = r1 + r2 - distance;

    return {
      entity1,
      entity2,
      contactNormal,
      overlap,
    };
  }

  private _generateSquareSquareCollision(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
  ): Collision {
    // Sanity check
    if (
      !(
        entity1.boundingShape instanceof BoundingBox &&
        entity2.boundingShape instanceof BoundingBox
      )
    ) {
      throw new Error("Sanity check failed: Invalid bounding shape type");
    }

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

    let contactNormal: [number, number];
    let overlap: number;
    if (penetrationX < penetrationY) {
      contactNormal = [dx > 0 ? 1 : -1, 0];
      overlap = penetrationX;
    } else {
      contactNormal = [0, dy > 0 ? 1 : -1];
      overlap = penetrationY;
    }

    return {
      entity1,
      entity2,
      contactNormal,
      overlap,
    };
  }

  private _generateCircleSquareCollision(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
  ): Collision {
    // Sanity check
    if (
      !(
        entity1.boundingShape instanceof BoundingCircle &&
        entity2.boundingShape instanceof BoundingBox
      )
    ) {
      throw new Error("Sanity check failed: Invalid bounding shape type");
    }

    // Calculate collision normal
    const [x1, y1] = entity1.position;
    const r1 = entity1.boundingShape.radius;

    const [x2, y2] = entity2.position;
    const [w2, h2] = [
      entity2.boundingShape.width,
      entity2.boundingShape.height,
    ];

    const dx = x1 - x2;
    const dy = y1 - y2;

    const penetrationX = r1 + w2 / 2 - Math.abs(dx);
    const penetrationY = r1 + h2 / 2 - Math.abs(dy);

    let contactNormal: [number, number];
    let overlap: number;
    if (penetrationX < penetrationY) {
      contactNormal = [dx > 0 ? 1 : -1, 0];
      overlap = penetrationX;
    } else {
      contactNormal = [0, dy > 0 ? 1 : -1];
      overlap = penetrationY;
    }

    return {
      entity1,
      entity2,
      contactNormal,
      overlap,
    };
  }

  private _generateCollision(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
  ): Collision {
    if (
      entity1.boundingShape instanceof BoundingBox &&
      entity2.boundingShape instanceof BoundingBox
    ) {
      const collision = this._generateSquareSquareCollision(entity1, entity2);
      return collision;
    } else if (
      entity1.boundingShape instanceof BoundingCircle &&
      entity2.boundingShape instanceof BoundingCircle
    ) {
      const collision = this._generateCircleCircleCollision(entity1, entity2);
      return collision;
    } else if (
      entity1.boundingShape instanceof BoundingBox &&
      entity2.boundingShape instanceof BoundingCircle
    ) {
      let collision = this._generateCircleSquareCollision(entity2, entity1);
      collision = {
        ...collision,
        contactNormal: [
          -collision.contactNormal[0],
          -collision.contactNormal[1],
        ],
      };
      return collision;
    } else if (
      entity1.boundingShape instanceof BoundingCircle &&
      entity2.boundingShape instanceof BoundingBox
    ) {
      const collision = this._generateCircleSquareCollision(entity1, entity2);
      return collision;
    } else {
      throw new Error("Missing types in correct penetration implementation");
    }
  }

  generateCollisions(
    collisionPairs: [PhysicsEntity, PhysicsEntity][],
  ): Collision[] {
    const collisions: Collision[] = [];
    for (let i = 0; i < collisionPairs.length; i++) {
      const [entity1, entity2] = collisionPairs[i];
      const collision = this._generateCollision(entity1, entity2);
      collisions.push(collision);
    }
    return collisions;
  }
}

export class CollisionResolver {
  private _restitution = 1.0;
  private _penetrationSlop = 0.3;

  solvePositions(collisions: Collision[], time: number) {
    for (const collision of collisions) {
      // this._resolvePenetaion(collision);
      this._applyCollisionImpulse(collision, time);
    }
  }

  private _resolvePenetaion({
    entity1,
    entity2,
    contactNormal,
    overlap,
  }: Collision) {
    const penetration = [
      contactNormal[0] * overlap,
      contactNormal[1] * overlap,
    ];

    // if (entity1.type === "dynamic" && entity2.type === "dynamic") {
    //   penX = Math.max(penX - this._penetrationSlop, 0);
    //   penY = Math.max(penY - this._penetrationSlop, 0);
    // }

    if (entity1.type === "dynamic") {
      entity1.position[0] -= penetration[0] / 15;
      entity1.position[1] -= penetration[1] / 15;
    }

    if (entity2.type === "dynamic") {
      entity2.position[0] += penetration[0] / 15;
      entity2.position[1] += penetration[1] / 15;
    }
  }

  private _applyCollisionImpulse(
    { entity1, entity2, contactNormal }: Collision,
    time: number,
  ) {
    // Calculate relative velocity
    const relativeVelocity = [
      entity1.velocity[0] - entity2.velocity[0],
      entity1.velocity[1] - entity2.velocity[1],
    ];

    // Calculate relative velocity in terms of the normal direction
    const magAlongNormal =
      relativeVelocity[0] * contactNormal[0] +
      relativeVelocity[1] * contactNormal[1];

    // Calculate impulse magnitude
    let dvx1 = 0;
    let dvy1 = 0;
    let dvx2 = 0;
    let dvy2 = 0;
    if (entity1.type === "dynamic") {
      dvx1 = contactNormal[0] * magAlongNormal * this._restitution;
      dvy1 = contactNormal[1] * magAlongNormal * this._restitution;
    } else {
      dvx2 = contactNormal[0] * magAlongNormal * this._restitution;
      dvy2 = contactNormal[1] * magAlongNormal * this._restitution;
    }

    if (entity2.type === "dynamic") {
      dvx2 = contactNormal[0] * magAlongNormal * this._restitution;
      dvy2 = contactNormal[1] * magAlongNormal * this._restitution;
    } else {
      dvx1 = contactNormal[0] * magAlongNormal * this._restitution;
      dvy1 = contactNormal[1] * magAlongNormal * this._restitution;
    }

    entity1.position[0] += dvx1 * time;
    entity1.position[1] += dvy1 * time;

    entity2.position[0] -= dvx2 * time;
    entity2.position[1] -= dvy2 * time;
  }
}
