import * as id from "../utils/id";

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
  physicsEntity: PhysicsEntity;

  delete(): void;
}

export class PhysicsEntity {
  readonly parent: Physical;
  readonly id: number;
  readonly type: PhysicsEntityType;
  readonly boundingShape: BoundingShape | undefined;

  position: [number, number];
  velocity: [number, number];

  rotation: number;
  angularVelocity: number;

  acceleration: [number, number];

  markedForDeletion: boolean = false;

  constructor({
    parent,
    type,
    boundingShape,
    position,
    velocity,
    rotation,
    angularVelocity,
    acceleration,
  }: {
    parent: Physical;
    type: PhysicsEntityType;
    boundingShape: BoundingShape;
    position: [number, number];
    velocity?: [number, number];
    rotation?: number;
    angularVelocity?: number;
    acceleration?: [number, number];
  }) {
    this.parent = parent;
    this.id = id.getNext();
    this.type = type;

    this.boundingShape = boundingShape;

    this.position = position;
    this.velocity = velocity ?? [0, 0];

    this.rotation = rotation ?? 0;
    this.angularVelocity = angularVelocity ?? 0;

    this.acceleration = acceleration ?? [0, 0];
  }

  delete() {
    if (this.markedForDeletion) {
      throw new Error(
        "Could not delete physics entity: already marked for deletion"
      );
    }
    this.markedForDeletion = true;
  }
}
