// Reference article: https://developer.ibm.com/tutorials/wa-build2dphysicsengine/
// Collision Resolution reference: https://spicyyoghurt.com/tutorials/html5-javascript-game-development/collision-detection-physics

import { Collision, CollisionDetector, CollisionResolver } from "./collision";
import { BoundingBox, BoundingCircle, Physical, PhysicsEntity } from "./entity";

const GRAVITY_X = 0;
const GRAVITY_Y = 9.8;

class Physics {
  private _entities: PhysicsEntity[] = [];
  private _collider: CollisionDetector = new CollisionDetector();
  private _resolver: CollisionResolver = new CollisionResolver();

  private _gravityEnabled: boolean = true;

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

  // PBD algorithm
  // Reference PBD: https://matthias-research.github.io/pages/publications/posBasedDyn.pdf
  // Reference 3.1 Particle Simulation Loop: https://matthias-research.github.io/pages/publications/PBDBodies.pdf
  private _numSubsteps = 5;
  private _solverIterations = 1;
  simulate(_elapsed?: number) {
    const elapsed = _elapsed ?? 1 / 5;

    const potentialCollisionPairs = this._collider.collectBroadCollisionPairs(
      this._entities,
    );

    const h = elapsed / this._numSubsteps;

    for (let i = 0; i < this._numSubsteps; i++) {
      for (const entity of this._entities) {
        entity.positionPrev = entity.position;

        if (entity.type === "dynamic" && this._gravityEnabled) {
          entity.velocity[0] += GRAVITY_X * h;
          entity.velocity[1] += GRAVITY_Y * h;
        }

        entity.position[0] += entity.velocity[0] * h;
        entity.position[1] += entity.velocity[1] * h;
      }

      let collisions: Collision[] = [];
      for (let i = 0; i < this._solverIterations; i++) {
        if (!potentialCollisionPairs) {
          break;
        }
        // TODO: Narrow phase collision detection
        collisions = this._collider.generateCollisions(potentialCollisionPairs);
        if (collisions.length === 0) {
          break;
        }

        this._resolver.solvePositions(collisions, h);
      }

      // Verlet integration
      for (const entity of this._entities) {
        if (entity.type !== "dynamic") {
          return;
        }

        entity.velocity[0] = (entity.position[0] - entity.positionPrev[0]) / h;
        entity.velocity[1] = (entity.position[1] - entity.positionPrev[1]) / h;

        entity.positionPrev = entity.position;
      }
    }
  }
}

export default Physics;
