import * as id from "../utils/id";
import type { EntityId } from "../core/entity";
import { createTransform, type Transform } from "../core/transform";

export type PhysicsEntityType = "kinematic" | "dynamic";

export type BoundingConvexPolygon = {
  type: "BoundingConvexPolygon";
  position: [number, number];
  vertices: [number, number][];
};

export type BoundingCircle = {
  type: "BoundingCircle";
  position: [number, number];
  radius: number;
};

export type BoundingShape = BoundingConvexPolygon | BoundingCircle;

export interface Physical {
  id: number;
  physicsEntity: PhysicsEntity;

  delete(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isPhysical = (object: any): object is Physical => {
  return object && "physicsEntity" in object;
};

export class PhysicsEntity {
  readonly parent: Physical;
  readonly ownerId: EntityId;
  readonly id: number;
  readonly type: PhysicsEntityType;
  readonly boundingShape: BoundingShape | undefined;

  private readonly _transform: Transform;
  velocity: [number, number];
  angularVelocity: number;

  acceleration: [number, number];

  markedForDeletion: boolean = false;

  constructor({
    parent,
    ownerId,
    transform,
    type,
    boundingShape,
    position,
    velocity,
    rotation,
    angularVelocity,
    acceleration,
  }: {
    parent?: Physical;
    ownerId?: EntityId;
    transform?: Transform;
    type: PhysicsEntityType;
    boundingShape: BoundingShape;
    position: [number, number];
    velocity?: [number, number];
    rotation?: number;
    angularVelocity?: number;
    acceleration?: [number, number];
  }) {
    // parent remains as a compatibility bridge for the collision-debug scenes.
    // New game code uses ownerId exclusively.
    this.parent = parent as Physical;
    this.ownerId = ownerId ?? parent?.id ?? id.getNext();
    this.id = id.getNext();
    this.type = type;

    this.boundingShape = boundingShape;

    this._transform =
      transform ?? createTransform({ position, rotation: rotation ?? 0 });
    this.boundingShape.position = this._transform.position;
    this.velocity = velocity ?? [0, 0];
    this.angularVelocity = angularVelocity ?? 0;

    this.acceleration = acceleration ?? [0, 0];
  }

  get transform() {
    return this._transform;
  }

  get position() {
    return this._transform.position;
  }

  set position(position: [number, number]) {
    this._transform.position[0] = position[0];
    this._transform.position[1] = position[1];
  }

  get rotation() {
    return this._transform.rotation;
  }

  set rotation(rotation: number) {
    this._transform.rotation = rotation;
  }

  delete() {
    if (this.markedForDeletion) {
      return;
    }
    this.markedForDeletion = true;
  }
}
