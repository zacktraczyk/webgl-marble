import { Drawable, DrawEntity, ProgramInfo } from "../vdu/entity";

export default class Line implements Drawable {
  private _begin: [number, number] = [0, 0];
  private _end: [number, number] = [0, 0];
  private _stroke: number = 0;

  drawEntity: DrawEntity | null = null;
  private readonly _position: [number, number] = [0, 0];
  private readonly _rotation: [number] = [0]; // radians
  private readonly _scale: [number, number] = [1, 1];
  private readonly _color: [number, number, number, number] = [1, 0, 0, 1];

  isMarkedForDeletion: boolean = false;

  constructor({
    begin,
    end,
    stroke,
    color,
  }: {
    begin: [number, number];
    end: [number, number];
    stroke: number;
    color?: [number, number, number, number];
  }) {
    this.begin = begin;
    this.end = end;
    this.stroke = stroke;

    this._color = color ?? [1, 0, 0, 1];
  }

  private _syncDrawEntityParams() {
    const dx = this._end[0] - this._begin[0];
    const dy = this._end[1] - this._begin[1];
    const length = Math.sqrt(dx * dx + dy * dy);

    this._position[0] = this._begin[0] + dx / 2;
    this._position[1] = this._begin[1] + dy / 2;

    this._scale[0] = length;
    this._scale[1] = this._stroke;

    this._rotation[0] = Math.atan2(dy, dx);
  }

  set begin(value: [number, number]) {
    this._begin = value;
    this._syncDrawEntityParams();
  }

  set end(value: [number, number]) {
    this._end = value;
    this._syncDrawEntityParams();
  }

  set stroke(value: number) {
    this._stroke = value;
    this._syncDrawEntityParams();
  }

  delete() {
    if (this.isMarkedForDeletion) {
      console.warn("Could not delete rectangle: already marked for deletion");
      return;
    }
    if (this.drawEntity) {
      this.drawEntity.delete();
    }
    this.isMarkedForDeletion = true;
  }

  initDrawEntity(
    gl: WebGLRenderingContext,
    programInfo: ProgramInfo,
  ): DrawEntity {
    if (this.drawEntity) {
      throw new Error("Draw entity already exists");
    }

    const indicies: number[] = [];

    indicies.push(0.5, -0.5);
    indicies.push(-0.5, -0.5);
    indicies.push(0.5, 0.5);

    indicies.push(-0.5, -0.5);
    indicies.push(-0.5, 0.5);
    indicies.push(0.5, 0.5);

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
}
