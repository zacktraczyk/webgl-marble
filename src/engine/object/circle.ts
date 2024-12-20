import { Physical, PhysicsEntity, PhysicsEntityType } from "../physics/entity";
import { Drawable, DrawEntity, ProgramInfo } from "../vdu/entity";

export class Circle implements Drawable, Physical {
  private readonly _position: [number, number];
  private readonly _rotation: [number, number];
  private readonly _color: [number, number, number, number] = [1, 0, 0, 1];
  readonly radius: number;

  readonly type: PhysicsEntityType;
  private readonly _velocity: [number, number];

  constructor({
    position,
    rotation,
    radius,
    color,

    type = "kinematic",
    velocity,
  }: {
    position: [number, number];
    rotation?: [number, number];
    radius: number;
    color?: [number, number, number, number];

    type?: PhysicsEntityType;
    velocity?: [number, number];
  }) {
    this._position = position;
    this._rotation = rotation ?? [0, 1];
    this._color = color ?? [1, 1, 1, 1];
    this.radius = radius;

    this.type = type;
    this._velocity = velocity ?? [0, 0];
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

  readonly segments = 32;
  readonly thetaStart = 0;
  readonly thetaLength = 2 * Math.PI;
  createDrawEntity(
    gl: WebGLRenderingContext,
    programInfo: ProgramInfo,
  ): DrawEntity {
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

    const drawObject = new DrawEntity({
      gl,
      programInfo,
      position: this._position,
      rotation: this._rotation,
      color: this._color,
      indicies,
    });

    return drawObject;
  }

  createPhysicsEntity(): PhysicsEntity {
    const physicsEntity: PhysicsEntity = new PhysicsEntity({
      type: this.type,
      position: this._position,
      boundingShapeParams: {
        type: "BoundingCircle",
        radius: this.radius,
      },
      velocity: this.velocity,
    });

    return physicsEntity;
  }
}
