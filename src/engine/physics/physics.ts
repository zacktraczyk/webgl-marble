// Reference article: https://developer.ibm.com/tutorials/wa-build2dphysicsengine/
// Collision Resolution reference: https://spicyyoghurt.com/tutorials/html5-javascript-game-development/collision-detection-physics

import { CollisionDetector, CollisionResolver } from "./collision";
import { BoundingBox, BoundingCircle, Physical, PhysicsEntity } from "./entity";

const GRAVITY_X = 0;
const GRAVITY_Y = 9.8;

class Physics {
  private _entities: PhysicsEntity[] = [];
  private _collider: CollisionDetector = new CollisionDetector();
  private _resolver: CollisionResolver = new CollisionResolver();

  private _gravity_enabled: boolean = true;

  add(physical: Physical) {
    const entity = physical.createPhysicsEntity();
    this._entities.push(entity);

    // TODO: Why does sim break if if circle is added first?
    this._entities.sort((a, b) =>
      a.boundingShape instanceof BoundingBox &&
      b.boundingShape instanceof BoundingCircle
        ? -1
        : 1,
    );
  }

  update(elapsed: number) {
    elapsed *= 0.005;

    const gx = GRAVITY_X * elapsed;
    const gy = GRAVITY_Y * elapsed;

    for (let i = 0; i < this._entities.length; i++) {
      const entity = this._entities[i];

      entity.velocity[0] += entity.acceleration[0] * elapsed;
      entity.velocity[1] += entity.acceleration[1] * elapsed;

      entity.position[0] += entity.velocity[0] * elapsed;
      entity.position[1] += entity.velocity[1] * elapsed;

      switch (entity.type) {
        case "dynamic":
          if (this._gravity_enabled) {
            entity.velocity[0] += gx;
            entity.velocity[1] += gy;
          }
          break;
        case "kinematic":
          break;
      }
    }

    const collisions = this._collider.detectCollisions(this._entities);

    if (collisions) {
      this._resolver.resolveCollisions(collisions);
    }
  }
}

export default Physics;
