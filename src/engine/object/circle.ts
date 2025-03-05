import * as id from "../../utils/id";
import { Physical, PhysicsEntity, PhysicsEntityType } from "../physics/entity";
import { Drawable, DrawEntity, ProgramInfo } from "../vdu/entity";

export class Circle implements Drawable, Physical {
  readonly id;
  readonly radius: number;

  private readonly _position: [number, number];
  private readonly _rotation: [number]; // radians
  private readonly _scale: [number, number];

  drawEntity: DrawEntity | null = null;
  private readonly _color: [number, number, number, number] = [1, 0, 0, 1];

  physicsEntity: PhysicsEntity | null = null;
  readonly type: PhysicsEntityType;
  private readonly _velocity: [number, number];

  isMarkedForDeletion: boolean = false;

  constructor({
    radius,

    position,
    rotation,
    scale,

    color,

    type = "kinematic",
    velocity,
  }: {
    radius: number;

    position: [number, number];
    rotation?: number;
    scale?: [number, number];

    color?: [number, number, number, number];

    type?: PhysicsEntityType;
    velocity?: [number, number];
  }) {
    this.id = id.getNext();
    this.radius = radius;

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
    if (this.drawEntity) {
      this.drawEntity.delete();
    }
    if (this.physicsEntity) {
      this.physicsEntity.delete();
    }
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

  readonly segments = 32;
  readonly thetaStart = 0;
  readonly thetaLength = 2 * Math.PI;
  createDrawEntity(
    gl: WebGLRenderingContext,
    programInfo: ProgramInfo,
  ): DrawEntity {
    if (this.drawEntity) {
      throw new Error("Draw entity already exists");
    }

    const indicies: number[] = [];

    for (let s = 0; s <= this.segments - 1; s++) {
      const segment = this.thetaStart + (s / this.segments) * this.thetaLength;
      const nextSegment =
        this.thetaStart + ((s - 1) / this.segments) * this.thetaLength;

      indicies.push(0, 0);

      indicies.push(
        this.radius * Math.cos(segment),
        this.radius * Math.sin(segment),
      );

      indicies.push(
        this.radius * Math.cos(nextSegment),
        this.radius * Math.sin(nextSegment),
      );
    }

    const drawEntity = new DrawEntity({
      parent: this,
      gl,
      programInfo,
      position: this._position,
      rotation: this._rotation,
      scale: this._scale,
      color: this._color,
      indicies,
    });

    this.drawEntity = drawEntity;
    return drawEntity;
  }

  createPhysicsEntity(): PhysicsEntity {
    if (this.physicsEntity) {
      throw new Error("Physics entity already exists");
    }

    const physicsEntity: PhysicsEntity = new PhysicsEntity({
      parent: this,
      type: this.type,
      position: this._position,
      boundingShapeParams: {
        type: "BoundingCircle",
        radius: this.radius,
      },
      velocity: this.velocity,
    });

    this.physicsEntity = physicsEntity;
    return physicsEntity;
  }
}
