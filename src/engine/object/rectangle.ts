import { Physical, PhysicsEntity, PhysicsEntityType } from "../physics/entity";
import { createRectangle, Drawable, DrawEntity } from "../vdu/entity";

export class Rectangle implements Drawable, Physical {
  readonly width: number;
  readonly height: number;
  position: [number, number];
  rotation: number; // radians
  scale: [number, number];
  color: [number, number, number, number];
  private _drawEntity: DrawEntity | null = null;
  private _physicsEntity: PhysicsEntity | null = null;
  readonly physicsType: PhysicsEntityType;
  velocity: [number, number];
  isMarkedForDeletion: boolean = false;

  constructor({
    width,
    height,
    position,
    rotation,
    scale,
    color,
    physicsType = "kinematic",
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
    this.width = width;
    this.height = height;
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
      this.physicsEntity.delete();
    }
    this.isMarkedForDeletion = true;
  }

  get drawEntities() {
    if (!this._drawEntity) {
      const entity = createRectangle({
        parent: this,
        width: this.width,
        height: this.height,
      });
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
          type: "BoundingBox",
          width: this.width,
          height: this.height,
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
