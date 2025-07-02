import * as id from "../utils/id";
import {
  type Physical,
  type PhysicsEntityType,
  PhysicsEntity,
} from "../physics/entity";
import { createCircle, type Drawable, type DrawEntity } from "../vdu/entity";
import { Arrow } from "./arrow";

export class Circle implements Drawable, Physical {
  readonly id;
  readonly radius: number;
  private _position: [number, number];
  rotation: number; // radians
  scale: [number, number];
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
    this._position = position;
    this.rotation = rotation ?? 0;
    this.scale = scale ?? [1, 1];
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
      this._drawEntity = entity;
    }

    return [this._drawEntity];
  }

  get physicsEntity() {
    if (!this._physicsEntity) {
      const entity: PhysicsEntity = new PhysicsEntity({
        parent: this,
        type: this.physicsType,
        position: this._position,
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

  get position() {
    return this._position;
  }

  set position(position: [number, number]) {
    this._position = position;
    if (this._physicsEntity) {
      this._physicsEntity.position = position;
    }
    if (this._drawEntity) {
      this._drawEntity.position = position;
    }
  }

  sync() {
    if (this._physicsEntity) {
      this._position = this._physicsEntity.position;
      this.velocity = this._physicsEntity.velocity;
    }

    if (this._drawEntity) {
      this._drawEntity.position = this._position;
      this._drawEntity.rotation = this.rotation;
      this._drawEntity.scale = this.scale;
      this._drawEntity.color = this.color;
    }
  }
}

export class Ball extends Circle {
  private _arrowParams: Partial<ConstructorParameters<typeof Arrow>[0]> = {
    tipLength: 10,
    stroke: 4,
    color: [0.8, 0.4, 0.6, 1],
  };
  private _arrowMagnitude: number;
  private _velocityArrow: Arrow | null = null;

  constructor(
    params: ConstructorParameters<typeof Circle>[0] & {
      arrowMagnitude?: number;
    }
  ) {
    const { arrowMagnitude, ...rest } = params;
    super(rest);
    this._arrowMagnitude = arrowMagnitude ?? params.radius * 2;
  }

  get direction() {
    const velocity = this.velocity;
    const length = Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2);
    return [velocity[0] / length, velocity[1] / length];
  }

  get drawEntities() {
    const entities = super.drawEntities;
    if (!this._velocityArrow) {
      this._velocityArrow = new Arrow({
        basePosition: this.position,
        tipPosition: [
          this.position[0] + this.direction[0] * 10,
          this.position[1] + this.direction[1] * 10,
        ],
        ...this._arrowParams,
      });
    }
    return [...entities, ...this._velocityArrow.drawEntities];
  }

  sync() {
    super.sync();
    if (this._velocityArrow) {
      this._velocityArrow.basePosition = this.position;
      this._velocityArrow.tipPosition = [
        this.position[0] + this.direction[0] * this._arrowMagnitude,
        this.position[1] + this.direction[1] * this._arrowMagnitude,
      ];
      this._velocityArrow.sync();
    }
  }
}
