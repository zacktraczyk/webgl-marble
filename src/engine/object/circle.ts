import * as id from "../utils/id";
import { createTransform, type Transform } from "../core/transform";
import {
  type Physical,
  type PhysicsEntityType,
  PhysicsEntity,
} from "../physics/entity";
import { createCircle, type Drawable, type DrawEntity } from "../vdu/entity";

export class Circle implements Drawable, Physical {
  readonly id;
  readonly radius: number;
  readonly transform: Transform;
  velocity: [number, number];
  color: [number, number, number, number] = [1, 0, 0, 1];
  private _drawEntity: DrawEntity | null = null;
  private _physicsEntity: PhysicsEntity | null = null;
  readonly physicsType: PhysicsEntityType;
  markedForDeletion: boolean = false;

  constructor({
    radius,
    position,
    rotation,
    scale,
    color,
    physicsType = "dynamic",
    velocity,
  }: {
    radius: number;
    position: [number, number];
    rotation?: number;
    scale?: [number, number];
    color?: [number, number, number, number];
    physicsType?: PhysicsEntityType;
    velocity?: [number, number];
  }) {
    this.id = id.getNext();
    this.radius = radius;
    this.transform = createTransform({ position, rotation, scale });
    this.color = color ?? [1, 1, 1, 1];
    this.physicsType = physicsType;
    this.velocity = velocity ?? [0, 0];
  }

  delete() {
    if (this.markedForDeletion) {
      console.warn("Could not delete rectangle: already marked for deletion");
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

  get drawEntities() {
    if (!this._drawEntity) {
      const entity = createCircle(this, this.radius);
      entity.attachToEntity(this.id, this.transform);
      this._drawEntity = entity;
    }

    return [this._drawEntity];
  }

  get physicsEntity() {
    if (!this._physicsEntity) {
      const entity: PhysicsEntity = new PhysicsEntity({
        parent: this,
        type: this.physicsType,
        position: this.transform.position,
        transform: this.transform,
        boundingShape: {
          type: "BoundingCircle",
          position: this.transform.position,
          radius: this.radius,
        },
        velocity: this.velocity,
      });
      this._physicsEntity = entity;
    }

    return this._physicsEntity;
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

  sync() {
    if (this._physicsEntity) {
      this.velocity = this._physicsEntity.velocity;
    }

    if (this._drawEntity) {
      this._drawEntity.color = this.color;
    }
  }
}
