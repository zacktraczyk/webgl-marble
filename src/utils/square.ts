import { Drawable } from "./vdu";

export class Square implements Drawable {
  private readonly _position: [number, number];
  private readonly _color: [number, number, number, number] = [1, 0, 0, 1];
  readonly width: number;

  constructor({
    position,
    width,
  }: {
    position: [number, number];
    width: number;
  }) {
    this._position = position;
    this.width = width;
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

  createIndicies(): number[] | Float32Array {
    const indicies: number[] = [];
    indicies.concat(this.position);

    indicies.push(
      this.position[0] + this.width * -(1 / 2),
      this.position[1] + this.width * -(1 / 2),
    );

    indicies.push(
      this.position[0] + this.width * (1 / 2),
      this.position[1] + this.width * -(1 / 2),
    );

    indicies.push(
      this.position[0] + this.width * (1 / 2),
      this.position[1] + this.width * (1 / 2),
    );

    indicies.push(
      this.position[0] + this.width * -(1 / 2),
      this.position[1] + this.width * (1 / 2),
    );

    return indicies;
  }
}
