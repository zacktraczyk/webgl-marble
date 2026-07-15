import * as id from "../utils/id";
import type { EntityId } from "../core/entity";
import { createTransform, type Transform } from "../core/transform";

export type PhysicsEntityType = "static" | "kinematic" | "dynamic";

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

export class PhysicsEntity {
  readonly ownerId: EntityId;
  readonly id: number;
  readonly type: PhysicsEntityType;
  readonly sensor: boolean;
  readonly boundingShape: BoundingShape | undefined;

  private readonly _transform: Transform;
  readonly mass: number;
  readonly inverseMass: number;
  readonly inertia: number;
  readonly inverseInertia: number;
  readonly friction: number;
  readonly restitution: number;
  velocity: [number, number];
  angularVelocity: number;

  acceleration: [number, number];

  markedForDeletion: boolean = false;

  constructor({
    ownerId,
    transform,
    type,
    sensor,
    boundingShape,
    position,
    velocity,
    rotation,
    angularVelocity,
    acceleration,
    mass,
    inertia,
    friction,
    restitution,
    fixedRotation,
  }: {
    ownerId: EntityId;
    transform?: Transform;
    type: PhysicsEntityType;
    sensor?: boolean;
    boundingShape: BoundingShape;
    position: [number, number];
    velocity?: [number, number];
    rotation?: number;
    angularVelocity?: number;
    acceleration?: [number, number];
    mass?: number;
    inertia?: number;
    friction?: number;
    restitution?: number;
    fixedRotation?: boolean;
  }) {
    this.ownerId = ownerId;
    this.id = id.getNext();
    this.type = type;
    this.sensor = sensor ?? false;

    this.boundingShape = boundingShape;

    this.friction = friction ?? 0.4;
    this.restitution = restitution ?? 0.8;
    if (!Number.isFinite(this.friction) || this.friction < 0) {
      throw new Error("Physics body friction must be finite and non-negative");
    }
    if (
      !Number.isFinite(this.restitution) ||
      this.restitution < 0 ||
      this.restitution > 1
    ) {
      throw new Error("Physics body restitution must be between 0 and 1");
    }

    if (type === "dynamic") {
      this.mass = mass ?? 1;
      if (!Number.isFinite(this.mass) || this.mass <= 0) {
        throw new Error("A dynamic physics body requires positive finite mass");
      }
      this.inverseMass = 1 / this.mass;
      this.inertia = fixedRotation
        ? 0
        : (inertia ?? calculateInertia(boundingShape, this.mass));
      if (
        !fixedRotation &&
        (!Number.isFinite(this.inertia) || this.inertia <= 0)
      ) {
        throw new Error(
          "A rotating dynamic physics body requires positive finite inertia"
        );
      }
      this.inverseInertia = fixedRotation ? 0 : 1 / this.inertia;
    } else {
      this.mass = 0;
      this.inverseMass = 0;
      this.inertia = 0;
      this.inverseInertia = 0;
    }

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

const calculateInertia = (shape: BoundingShape, mass: number) => {
  if (shape.type === "BoundingCircle") {
    return 0.5 * mass * shape.radius * shape.radius;
  }

  let doubleArea = 0;
  let inertiaNumerator = 0;
  for (let i = 0; i < shape.vertices.length; i++) {
    const a = shape.vertices[i];
    const b = shape.vertices[(i + 1) % shape.vertices.length];
    const cross = a[0] * b[1] - a[1] * b[0];
    doubleArea += cross;
    inertiaNumerator +=
      cross *
      (a[0] * a[0] +
        a[0] * b[0] +
        b[0] * b[0] +
        a[1] * a[1] +
        a[1] * b[1] +
        b[1] * b[1]);
  }
  if (Math.abs(doubleArea) <= Number.EPSILON) {
    return 0;
  }
  return (mass * Math.abs(inertiaNumerator)) / (6 * Math.abs(doubleArea));
};
