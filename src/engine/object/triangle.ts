import {
  PhysicsEntity,
  type Physical,
  type PhysicsEntityType,
} from "../physics/entity";
import { createTransform, type Transform } from "../core/transform";
import { getNext } from "../utils/id";
import {
  createRightTriangle,
  type Drawable,
  type DrawEntity,
} from "../vdu/entity";
import { Line } from "./line";

// TODO: Optimize!!
export class TriangleOutline implements Drawable {
  readonly id;
  readonly vertices: [[number, number], [number, number], [number, number]];
  readonly color: [number, number, number, number];
  private _rotation: number; // radians
  private _scale: [number, number];
  private _position: [number, number];

  private _line1: Line | null = null;
  private _line2: Line | null = null;
  private _line3: Line | null = null;
  markedForDeletion: boolean = false;

  constructor({
    vertices,
    color,
  }: {
    vertices: [[number, number], [number, number], [number, number]];
    color: [number, number, number, number];
  }) {
    this.id = getNext();
    // NOTE: Vertices must be in counter-clockwise order
    this.vertices = [...vertices];
    this.color = color;
    this._rotation = 0;
    this._scale = [1, 1];
    this._position = [0, 0];
  }

  get position() {
    return this._position;
  }

  set position(position: [number, number]) {
    throw new Error("Cannot set position of Triangle");
  }

  get rotation() {
    return this._rotation;
  }

  set rotation(rotation: number) {
    throw new Error("Cannot set rotation of Triangle");
  }

  get scale() {
    return this._scale;
  }

  set scale(scale: [number, number]) {
    throw new Error("Cannot set scale of Triangle");
  }

  get drawEntities(): DrawEntity[] {
    if (!this._line1) {
      this._line1 = new Line({
        startPosition: this.vertices[0],
        endPosition: this.vertices[1],
        color: this.color,
        stroke: 2,
      });
    }
    if (!this._line2) {
      this._line2 = new Line({
        startPosition: this.vertices[1],
        endPosition: this.vertices[2],
        color: this.color,
        stroke: 2,
      });
    }
    if (!this._line3) {
      this._line3 = new Line({
        startPosition: this.vertices[2],
        endPosition: this.vertices[0],
        color: this.color,
        stroke: 2,
      });
    }

    return [
      ...this._line1.drawEntities,
      ...this._line2.drawEntities,
      ...this._line3.drawEntities,
    ];
  }

  delete() {
    if (this._line1) {
      this._line1.delete();
    }
    if (this._line2) {
      this._line2.delete();
    }
    if (this._line3) {
      this._line3.delete();
    }
  }

  sync() {
    if (this._line1) {
      this._line1.startPosition = this.vertices[0];
      this._line1.endPosition = this.vertices[1];
      this._line1.color = this.color;
      this._line1.sync();
    }
    if (this._line2) {
      this._line2.startPosition = this.vertices[1];
      this._line2.endPosition = this.vertices[2];
      this._line2.color = this.color;
      this._line2.sync();
    }
    if (this._line3) {
      this._line3.startPosition = this.vertices[2];
      this._line3.endPosition = this.vertices[0];
      this._line3.color = this.color;
      this._line3.sync();
    }
  }
}

export class RightTriangle implements Drawable, Physical {
  readonly id;
  readonly width: number;
  readonly height: number;
  readonly transform: Transform;
  private _color: [number, number, number, number];
  private _drawEntity: DrawEntity | null = null;
  private _physicsEntity: PhysicsEntity | null = null;
  readonly physicsType: PhysicsEntityType;
  private _velocity: [number, number];
  markedForDeletion: boolean = false;

  constructor({
    width,
    height,
    position,
    rotation,
    scale,
    color,
    physicsType,
    velocity,
  }: {
    width: number;
    height: number;
    position: [number, number];
    rotation?: number;
    scale?: [number, number];
    color?: [number, number, number, number];
    physicsType?: PhysicsEntityType;
    velocity?: [number, number];
  }) {
    this.id = getNext();
    this.width = width;
    this.height = height;
    this.transform = createTransform({ position, rotation, scale });
    this._color = color ?? [1, 1, 1, 1];
    this.physicsType = physicsType ?? "kinematic";
    this._velocity = velocity ?? [0, 0];
  }

  get position() {
    return this.transform.position;
  }

  set position(position: [number, number]) {
    this.transform.position[0] = position[0];
    this.transform.position[1] = position[1];
  }

  get rotation() {
    return this.transform.rotation;
  }

  set rotation(rotation: number) {
    this.transform.rotation = rotation;
  }

  get scale() {
    return this.transform.scale;
  }

  set scale(scale: [number, number]) {
    this.transform.scale[0] = scale[0];
    this.transform.scale[1] = scale[1];
  }

  get drawEntities(): DrawEntity[] {
    if (!this._drawEntity) {
      this._drawEntity = createRightTriangle(this, this.width, this.height);
      this._drawEntity.attachToEntity(this.id, this.transform);
    }

    return [this._drawEntity];
  }

  get velocity() {
    return this._velocity;
  }

  set velocity(velocity: [number, number]) {
    this._velocity = velocity;
    if (this._physicsEntity) {
      this._physicsEntity.velocity = velocity;
    }
  }

  delete() {
    if (this.markedForDeletion) {
      return;
    }
    if (this._drawEntity) {
      this._drawEntity.delete();
    }
    if (this._physicsEntity) {
      this._physicsEntity.delete();
    }
    this.markedForDeletion = true;
  }

  sync() {
    if (this._physicsEntity) {
      this._velocity = this._physicsEntity.velocity;
    }

    if (this._drawEntity) {
      this._drawEntity.color = this._color;
    }
  }

  get physicsEntity() {
    if (!this._physicsEntity) {
      const vertices: [number, number][] = [
        [this.width * (-1 / 2), this.height * (-1 / 2)],
        [this.width * (1 / 2), this.height * (1 / 2)],
        [this.width * (-1 / 2), this.height * (1 / 2)],
      ];
      const entity: PhysicsEntity = new PhysicsEntity({
        parent: this,
        type: this.physicsType,
        position: this.transform.position,
        rotation: this.transform.rotation,
        transform: this.transform,
        velocity: this.velocity,
        boundingShape: {
          type: "BoundingConvexPolygon",
          position: this.transform.position,
          vertices,
        },
      });
      this._physicsEntity = entity;
    }

    return this._physicsEntity;
  }
}
