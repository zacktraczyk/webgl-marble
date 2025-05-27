import * as id from "../../utils/id";
import { Physical, PhysicsEntity, PhysicsEntityType } from "../physics/entity";
import { createCircle, Drawable, DrawEntity } from "../vdu/entity";

export class Circle implements Drawable, Physical {
  readonly id;
  readonly radius: number;
  position: [number, number];
  rotation: number; // radians
  scale: [number, number];
  velocity: [number, number];
  color: [number, number, number, number] = [1, 0, 0, 1];
  private _drawEntity: DrawEntity | null = null;
  private _physicsEntity: PhysicsEntity | null = null;
  readonly physicsType: PhysicsEntityType;
  isMarkedForDeletion: boolean = false;

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
    this.position = position;
    this.rotation = rotation ?? 0;
    this.scale = scale ?? [1, 1];
    this.color = color ?? [1, 1, 1, 1];
    this.physicsType = physicsType;
    this.velocity = velocity ?? [0, 0];
  }

  delete() {
    if (this.isMarkedForDeletion) {
      console.warn("Could not delete rectangle: already marked for deletion");
      return;
    }
    if (this._drawEntity) {
      this._drawEntity.delete();
    }
    if (this._physicsEntity) {
      this._physicsEntity.delete();
    }
    this.isMarkedForDeletion = true;
  }

  get drawEntities() {
    if (!this._drawEntity) {
      const entity = createCircle(this, this.radius);
      this._drawEntity = entity;
    }

    return [this._drawEntity];
  }

  get physicsEntity() {
    if (!this._physicsEntity) {
      const entity: PhysicsEntity = new PhysicsEntity({
        parent: this,
        type: this.physicsType,
        position: this.position,
        boundingShapeParams: {
          type: "BoundingCircle",
          radius: this.radius,
        },
        velocity: this.velocity,
      });
      this._physicsEntity = entity;
    }

    return this._physicsEntity;
  }

  sync() {
    if (this._physicsEntity) {
      this.position = this._physicsEntity.position;
      this.velocity = this._physicsEntity.velocity;
    }

    if (this._drawEntity) {
      this._drawEntity.position = this.position;
      this._drawEntity.rotation = this.rotation;
      this._drawEntity.scale = this.scale;
      this._drawEntity.color = this.color;
    }
  }
}
