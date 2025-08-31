// Reference article: https://developer.ibm.com/tutorials/wa-build2dphysicsengine/
// Collision Resolution reference: https://spicyyoghurt.com/tutorials/html5-javascript-game-development/collision-detection-physics

import { Observer } from "../utils/Observer";
import {
  type CollisionDetector,
  type CollisionResolver,
  type Collision,
} from "./collision";
import { GeneralCollisionResolver } from "./collision/general";
import { SATCollisionDetector } from "./collision/SAT";
import { type Physical, PhysicsEntity } from "./entity";

const GRAVITY_X = 0;
const GRAVITY_Y = 9.8;

export type CollisionEvents = {
  collisions: Collision[];
};

class Physics {
  private _entities: PhysicsEntity[] = [];
  private readonly _collider: CollisionDetector;
  private readonly _resolver: CollisionResolver;
  private _observer: Observer<CollisionEvents> =
    new Observer<CollisionEvents>();

  constructor(params?: {
    collisionDetector?: CollisionDetector;
    collisionResolver?: CollisionResolver;
  }) {
    const { collisionDetector, collisionResolver } = params ?? {};

    this._collider = collisionDetector ?? new SATCollisionDetector();
    this._resolver = collisionResolver ?? new GeneralCollisionResolver();
  }

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
      (entity) => !entity.markedForDeletion
    );

    this._entities = filteredEntities;
  }

  add({ physicsEntity }: Physical) {
    this._entities.push(physicsEntity);
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
