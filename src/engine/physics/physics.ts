// Reference article: https://developer.ibm.com/tutorials/wa-build2dphysicsengine/
// Collision Resolution reference: https://spicyyoghurt.com/tutorials/html5-javascript-game-development/collision-detection-physics

import { Observer } from "../utils/Observer";
import type { EntityId } from "../core/entity";
import type { Transform } from "../core/transform";
import {
  type CollisionDetector,
  type CollisionResolver,
  type Collision,
} from "./collision";
import { GeneralCollisionResolver } from "./collision/general";
import { GJKCollisionDetector } from "./collision/GJK";
import { type Physical, PhysicsEntity } from "./entity";
import type {
  ColliderDefinition,
  PhysicsComponentDefinition,
} from "./component";

const GRAVITY_X = 0;
const GRAVITY_Y = 9.8;

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
  private readonly _collider: CollisionDetector;
  private readonly _resolver: CollisionResolver;
  private _observer: Observer<CollisionEvents> =
    new Observer<CollisionEvents>();

  constructor(params?: {
    collisionDetector?: CollisionDetector;
    collisionResolver?: CollisionResolver;
  }) {
    const { collisionDetector, collisionResolver } = params ?? {};

    this._collider = collisionDetector ?? new GJKCollisionDetector();
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

  dispose() {
    this._entities = [];
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
      boundingShape: this._toBoundingShape(collider, transform.position),
      position: transform.position,
      velocity: definition.velocity,
      angularVelocity: definition.angularVelocity,
      acceleration: definition.acceleration,
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
        return {
          type: "BoundingCircle" as const,
          position,
          radius: collider.radius,
        };
      case "polygon":
        return {
          type: "BoundingConvexPolygon" as const,
          position,
          vertices: collider.vertices,
        };
    }
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

    elapsed *= 0.008;

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
      this._observer.notify({
        collisions,
        entityCollisions: collisions.map(
          ({ entity1, entity2, minimumTranslationVector }) => ({
            entity1: entity1.ownerId,
            entity2: entity2.ownerId,
            normal: minimumTranslationVector.normal,
            magnitude: minimumTranslationVector.magnitude,
          })
        ),
      });
      this._resolver.resolveCollisions(collisions);
    }
  }
}

export default Physics;
