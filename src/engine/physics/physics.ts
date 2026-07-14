// Reference article: https://developer.ibm.com/tutorials/wa-build2dphysicsengine/
// Collision Resolution reference: https://spicyyoghurt.com/tutorials/html5-javascript-game-development/collision-detection-physics

import { Observer } from "../utils/Observer";
import type { EntityId } from "../core/entity";
import type { Transform } from "../core/transform";
import {
  type BroadPhase,
  type Collision,
  type ContactSolver,
  type NarrowPhase,
  NaiveAabbBroadPhase,
  SATNarrowPhase,
  SequentialImpulseSolver,
} from "./collision";
import { assertValidConvexPolygon } from "./collision/geometry";
import { type Physical, PhysicsEntity } from "./entity";
import type {
  ColliderDefinition,
  PhysicsComponentDefinition,
} from "./component";

const GRAVITY_X = 0;
const GRAVITY_Y = 9.8;

export const millisecondsToSimulationSeconds = (milliseconds: number) =>
  milliseconds * 0.008;

export type CollisionEvents = {
  collisions: Collision[];
  entityCollisions: EntityCollision[];
};

export type EntityCollision = {
  entity1: EntityId;
  entity2: EntityId;
  normal: [number, number];
  magnitude: number;
};

class Physics {
  private _entities: PhysicsEntity[] = [];
  private readonly _broadPhase: BroadPhase;
  private readonly _narrowPhase: NarrowPhase;
  private readonly _contactSolver: ContactSolver;
  private _observer: Observer<CollisionEvents> =
    new Observer<CollisionEvents>();

  constructor(params?: {
    broadPhase?: BroadPhase;
    narrowPhase?: NarrowPhase;
    contactSolver?: ContactSolver;
  }) {
    const { broadPhase, narrowPhase, contactSolver } = params ?? {};

    this._broadPhase = broadPhase ?? new NaiveAabbBroadPhase();
    this._narrowPhase = narrowPhase ?? new SATNarrowPhase();
    this._contactSolver = contactSolver ?? new SequentialImpulseSolver();
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

  dispose() {
    this._entities = [];
    this._observer.clear();
    this._contactSolver.clear?.();
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

  addEntity(
    ownerId: EntityId,
    transform: Transform,
    definition: PhysicsComponentDefinition
  ) {
    const collider = definition.collider;
    const entity = new PhysicsEntity({
      ownerId,
      transform,
      type: definition.type,
      sensor: definition.sensor,
      boundingShape: this._toBoundingShape(collider, transform.position),
      position: transform.position,
      velocity: definition.velocity,
      angularVelocity: definition.angularVelocity,
      acceleration: definition.acceleration,
      mass: definition.mass,
      inertia: definition.inertia,
      friction: definition.friction,
      restitution: definition.restitution,
      fixedRotation: definition.fixedRotation,
    });
    this._entities.push(entity);
    return entity;
  }

  removeEntity(ownerId: EntityId) {
    for (const entity of this._entities) {
      if (entity.ownerId === ownerId) {
        entity.delete();
      }
    }
  }

  getEntity(ownerId: EntityId) {
    return this._entities.find((entity) => entity.ownerId === ownerId);
  }

  private _toBoundingShape(
    collider: ColliderDefinition,
    position: [number, number]
  ) {
    switch (collider.type) {
      case "circle":
        if (!Number.isFinite(collider.radius) || collider.radius <= 0) {
          throw new Error(
            "A circle collider requires a finite positive radius"
          );
        }
        return {
          type: "BoundingCircle" as const,
          position,
          radius: collider.radius,
        };
      case "polygon": {
        const shape = {
          type: "BoundingConvexPolygon" as const,
          position,
          vertices: collider.vertices.map(([x, y]): [number, number] => [x, y]),
        };
        assertValidConvexPolygon(shape);
        return shape;
      }
    }
  }

  private _detectCollisions() {
    const collisions: Collision[] = [];
    const pairs = this._broadPhase.findPairs(this._entities);
    for (const [entity1, entity2] of pairs) {
      const collision = this._narrowPhase.detectCollision(entity1, entity2);
      if (collision) {
        collisions.push(collision);
      }
    }
    return collisions;
  }

  // Simulation

  update(elapsed: number) {
    if (!Number.isFinite(elapsed)) {
      throw new Error("Physics update requires a finite elapsed time");
    }
    if (elapsed <= 0) {
      return;
    }
    if (elapsed > 100) {
      console.debug("Skipping physics update: elapsed time is too high", {
        elapsed,
      });
      return;
    }

    this._cleanup();

    const deltaSeconds = millisecondsToSimulationSeconds(elapsed);

    const gx = GRAVITY_X * deltaSeconds;
    const gy = GRAVITY_Y * deltaSeconds;

    for (let i = 0; i < this._entities.length; i++) {
      const entity = this._entities[i];

      switch (entity.type) {
        case "static":
          break;
        case "dynamic":
          entity.velocity[0] += entity.acceleration[0] * deltaSeconds;
          entity.velocity[1] += entity.acceleration[1] * deltaSeconds;
          if (this._gravity_enabled) {
            entity.velocity[0] += gx;
            entity.velocity[1] += gy;
          }
          entity.position[0] += entity.velocity[0] * deltaSeconds;
          entity.position[1] += entity.velocity[1] * deltaSeconds;
          entity.rotation += entity.angularVelocity * deltaSeconds;
          break;
        case "kinematic":
          entity.velocity[0] += entity.acceleration[0] * deltaSeconds;
          entity.velocity[1] += entity.acceleration[1] * deltaSeconds;
          entity.position[0] += entity.velocity[0] * deltaSeconds;
          entity.position[1] += entity.velocity[1] * deltaSeconds;
          entity.rotation += entity.angularVelocity * deltaSeconds;
          break;
      }
    }

    const collisions = this._detectCollisions();

    if (collisions.length > 0) {
      this._observer.notify({
        collisions,
        entityCollisions: collisions.map(({ entity1, entity2, manifold }) => ({
          entity1: entity1.ownerId,
          entity2: entity2.ownerId,
          normal: manifold.normal,
          magnitude: manifold.penetrationDepth,
        })),
      });
    }
    const solidCollisions = collisions.filter(
      ({ entity1, entity2 }) => !entity1.sensor && !entity2.sensor
    );
    this._contactSolver.solve(solidCollisions, deltaSeconds);
  }
}

export default Physics;
