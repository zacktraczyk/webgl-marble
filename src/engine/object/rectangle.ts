import { Physical, PhysicsEntity, PhysicsEntityType } from "../physics/entity";
import { Drawable, DrawEntity, ProgramInfo } from "../vdu/entity";

export class Rectangle implements Drawable, Physical {
  private readonly _position: [number, number];
  private readonly _rotation: [number, number];
  private readonly _color: [number, number, number, number];
  readonly width: number;
  readonly height: number;

  readonly type: PhysicsEntityType;
  private readonly _velocity: [number, number];

  private _drawEntity: DrawEntity | null = null;
  private _physicsEntity: PhysicsEntity | null = null;

  isMarkedForDeletion: boolean = false;

  constructor({
    position,
    rotation,
    width,
    height,
    color,

    type = "kinematic",
    velocity,
  }: {
    position: [number, number];
    rotation?: [number, number];
    width: number;
    height: number;
    color?: [number, number, number, number];

    type?: PhysicsEntityType;
    velocity?: [number, number];
  }) {
    this._position = position;
    this._rotation = rotation ?? [0, 1];
    this.width = width;
    this.height = height;
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

  set position(center: [number, number]) {
    this._position[0] = center[0];
    this._position[1] = center[1];
  }

  get position() {
    return this._position;
  }

  get rotation() {
    const angleInRadians = Math.atan2(this._rotation[0], this._rotation[1]);
    const angleInDegrees = (angleInRadians * 180) / Math.PI;
    return angleInDegrees;
  }

  set rotation(degrees: number) {
    const angleInRadians = (degrees * Math.PI) / 180;
    this._rotation[0] = Math.sin(angleInRadians);
    this._rotation[1] = Math.cos(angleInRadians);
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