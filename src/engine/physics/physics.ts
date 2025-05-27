// Reference article: https://developer.ibm.com/tutorials/wa-build2dphysicsengine/
// Collision Resolution reference: https://spicyyoghurt.com/tutorials/html5-javascript-game-development/collision-detection-physics

import { Observer } from "../../utils/Observer";
import { BoundingBox, BoundingCircle } from "./boundingShape";
import { CollisionDetector, CollisionResolver } from "./collision";
import { Physical, PhysicsEntity } from "./entity";

const GRAVITY_X = 0;
const GRAVITY_Y = 9.8;

type CollisionEvents = {
  collisions: [PhysicsEntity, PhysicsEntity][];
};

class Physics {
  private _entities: PhysicsEntity[] = [];
  private _collider: CollisionDetector = new CollisionDetector();
  private _resolver: CollisionResolver = new CollisionResolver();
  private _observer: Observer<CollisionEvents> =
    new Observer<CollisionEvents>();

  private _gravity_enabled: boolean = true;

  // Observer

  register(observer: (data: CollisionEvents) => void) {
    this._observer.register(observer);
  }

  unregister(observer: (data: CollisionEvents) => void) {
    this._observer.unregister(observer);
  }

  clear() {
    this._observer.clear();
  }

  // Entity

  private _cleanup() {
    const filteredEntities = this._entities.filter(
      (entity) => !entity.markedForDeletion,
    );

    this._entities = filteredEntities;
  }

  add({ physicsEntity }: Physical) {
    this._entities.push(physicsEntity);

    // TODO: FIXME Why does sim break if if circle is added first?
    this._entities.sort((a, b) =>
      a.boundingShape instanceof BoundingBox &&
      b.boundingShape instanceof BoundingCircle
        ? -1
        : 1,
    );
  }

  // Simulation

  update(elapsed: number) {
    if (elapsed > 100) {
      console.debug("Skipping physics update: elapsed time is too high", {
        elapsed,
      });
      return;
    }

    this._cleanup();

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
      this._observer.notify({ collisions });
      this._resolver.resolveCollisions(collisions);
    }
  }
}

export default Physics;
