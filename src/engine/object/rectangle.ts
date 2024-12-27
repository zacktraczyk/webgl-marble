import { Physical, PhysicsEntity, PhysicsEntityType } from "../physics/entity";
import { Drawable, DrawEntity, ProgramInfo } from "../vdu/entity";

export class Rectangle implements Drawable, Physical {
  readonly width: number;
  readonly height: number;

  private readonly _position: [number, number];
  private readonly _rotation: [number]; // degrees
  private readonly _scale: [number, number];

  private _drawEntity: DrawEntity | null = null;
  private readonly _color: [number, number, number, number];

  private _physicsEntity: PhysicsEntity | null = null;
  readonly type: PhysicsEntityType;
  private readonly _velocity: [number, number];

  isMarkedForDeletion: boolean = false;

  constructor({
    width,
    height,

    position,
    rotation,
    scale,

    color,

    type = "kinematic",
    velocity,
  }: {
    width: number;
    height: number;

    position: [number, number];
    rotation?: number;
    scale?: [number, number];

    color?: [number, number, number, number];

    type?: PhysicsEntityType;
    velocity?: [number, number];
  }) {
    this.width = width;
    this.height = height;

    this._position = position;
    this._rotation = [rotation ?? 0];
    this._scale = scale ?? [1, 1];

    this._color = color ?? [1, 1, 1, 1];

    this.type = type;
    this._velocity = velocity ?? [0, 0];
  }

  delete() {
    if (this.isMarkedForDeletion) {
      console.warn("Could not delete rectangle: already marked for deletion");
      return;
    }
    this.deleteDrawEntity();
    this.deletePhysicsEntity();
    this.isMarkedForDeletion = true;
  }

  get position() {
    return this._position;
  }

  set position(center: [number, number]) {
    this._position[0] = center[0];
    this._position[1] = center[1];
  }

  get rotation() {
    return this._rotation[0];
  }

  set rotation(degrees: number) {
    this._rotation[0] = degrees;
  }

  get scale() {
    return this._scale;
  }

  private set scale(scale: [number, number]) {
    this._scale[0] = scale[0];
    this._scale[1] = scale[1];
  }

  get color() {
    return this._color;
  }

  set color(color: [number, number, number, number]) {
    this._color[0] = color[0];
    this._color[1] = color[1];
    this._color[2] = color[2];
    this._color[3] = color[3];
  }

  get velocity() {
    return this._velocity;
  }

  set velocity(velocity: [number, number]) {
    this._velocity[0] = velocity[0];
    this._velocity[1] = velocity[1];
  }

  // Drawable

  createDrawEntity(
    gl: WebGLRenderingContext,
    programInfo: ProgramInfo,
  ): DrawEntity {
    if (this._drawEntity) {
      console.warn("Could not create draw entity: already created");
      return this._drawEntity;
    }

    const indicies: number[] = [];

    indicies.push(this.width * (1 / 2), this.height * -(1 / 2));
    indicies.push(this.width * -(1 / 2), this.height * -(1 / 2));
    indicies.push(this.width * (1 / 2), this.height * (1 / 2));

    indicies.push(this.width * -(1 / 2), this.height * -(1 / 2));
    indicies.push(this.width * -(1 / 2), this.height * (1 / 2));
    indicies.push(this.width * (1 / 2), this.height * (1 / 2));

    const drawObject = new DrawEntity({
      parent: this,
      gl,
      programInfo,
      position: this._position,
      rotation: this._rotation,
      scale: this._scale,
      color: this._color,
      indicies,
    });

    this._drawEntity = drawObject;
    return drawObject;
  }

  deleteDrawEntity() {
    if (!this._drawEntity) {
      console.warn("Could not delete draw entity: already deleted");
      return;
    }
    this._drawEntity.markedForDeletion = true;
    this._drawEntity = null;
  }

  // Physical

  get physicsEntity(): PhysicsEntity | null {
    return this._physicsEntity;
  }

  createPhysicsEntity(): PhysicsEntity {
    const physicsEntity: PhysicsEntity = new PhysicsEntity({
      parent: this,
      type: this.type,
      position: this._position,
      boundingShapeParams: {
        type: "BoundingBox",
        width: this.width,
        height: this.height,
      },
      velocity: this._velocity,
    });

    this._physicsEntity = physicsEntity;
    return physicsEntity;
  }

  deletePhysicsEntity() {
    if (!this._physicsEntity) {
      console.warn("Could not delete physics entity: already deleted");
      return;
    }
    this._physicsEntity.markedForDeletion = true;
    this._physicsEntity = null;
  }
}
