import type { Collision, CollisionResolver } from ".";

export class GeneralCollisionResolver implements CollisionResolver {
  private _restitution = 0.8;
  private _penetrationSlop = 0.8;

  resolveCollisions(collisions: Collision[]) {
    for (let i = 0; i < collisions.length; i++) {
      this._resolveCollision(collisions[i]);
    }
  }

  private _resolveCollision(collision: Collision) {
    const { entity1, entity2, minimumTranslationVector } = collision;

    // Correct penetration
    const { normal, magnitude } = minimumTranslationVector;
    const penX = normal[0] * magnitude;
    const penY = normal[1] * magnitude;

    // NOTE: Only dynamic entities should be corrected (or else dynamic entities
    // get stuck in kinematic entities)
    // if (entity1.type === "dynamic" && entity2.type === "dynamic") {
    //   penX = Math.max(penX - this._penetrationSlop, 0);
    //   penY = Math.max(penY - this._penetrationSlop, 0);
    // }

    if (entity1.type === "dynamic") {
      entity1.position[0] -= penX;
      entity1.position[1] -= penY;
    }

    if (entity2.type === "dynamic") {
      entity2.position[0] += penX;
      entity2.position[1] += penY;
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
    } else if (entity2.type === "dynamic") {
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
    } else if (entity1.type === "dynamic") {
      entity1.velocity[0] -=
        normal[0] * relativeNormalVelocity * this._restitution;
      entity1.velocity[1] -=
        normal[1] * relativeNormalVelocity * this._restitution;
    }
  }
}
