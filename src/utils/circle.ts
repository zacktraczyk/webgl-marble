import { Drawable } from "./vdu";

export class Circle implements Drawable {
  private readonly _position: [number, number];
  private readonly _color: [number, number, number, number] = [1, 0, 0, 1];
  readonly radius: number;

  constructor({
    position,
    radius,
    color,
  }: {
    position: [number, number];
    radius: number;
    color?: [number, number, number, number];
  }) {
    this._position = position;
    this._color = color ?? [1, 1, 1, 1];
    this.radius = radius;
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

  readonly segments = 32;
  readonly thetaStart = 0;
  readonly thetaLength = 2 * Math.PI;
  createIndicies(): number[] | Float32Array {
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

    return indicies;
  }
}
