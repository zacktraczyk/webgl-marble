import { EntityType, Physical, PhysicsEntity } from "./physics";
import { Drawable, DrawObject } from "./vdu";
import * as WebglUtils from "./webglUtils";

export class Rectangle implements Drawable, Physical {
  private readonly _position: [number, number];
  private readonly _color: [number, number, number, number] = [1, 0, 0, 1];
  readonly width: number;
  readonly height: number;
  readonly type: EntityType;

  constructor({
    position,
    width,
    height,
    color,
    type = "kinematic",
  }: {
    position: [number, number];
    width: number;
    height: number;
    color?: [number, number, number, number];
    type?: EntityType;
  }) {
    this._position = position;
    this.width = width;
    this.height = height;
    this._color = color ?? [1, 1, 1, 1];
    this.type = type;
  }

  set position(center: [number, number]) {
    this._position[0] = center[0];
    this._position[1] = center[1];
  }

  get position() {
    return this._position;
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

  createDrawObject(
    gl: WebGLRenderingContext,
    programInfo: WebglUtils.ProgramInfo,
  ): DrawObject {
    const indicies: number[] = [];

    indicies.push(this.width * (1 / 2), this.height * -(1 / 2));
    indicies.push(this.width * -(1 / 2), this.height * -(1 / 2));
    indicies.push(this.width * (1 / 2), this.height * (1 / 2));

    indicies.push(this.width * -(1 / 2), this.height * -(1 / 2));
    indicies.push(this.width * -(1 / 2), this.height * (1 / 2));
    indicies.push(this.width * (1 / 2), this.height * (1 / 2));

    const drawObject = new DrawObject({
      gl,
      programInfo,
      position: this.position,
      color: this.color,
      indicies,
    });

    return drawObject;
  }

  createPhysicsEntity(): PhysicsEntity {
    const physicsEntity: PhysicsEntity = new PhysicsEntity({
      type: this.type,
      position: this.position,
      boundingBoxParams: {
        shape: {
          type: "AABB",
          width: this.width,
          height: this.height,
        },
      },
    });

    return physicsEntity;
  }
}
