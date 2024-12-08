import { Drawable } from "./vdu";

export class Circle implements Drawable {
  private readonly _position: [number, number];
  private readonly _color: [number, number, number, number] = [1, 0, 0, 1];
  readonly radius: number;

  constructor({
    position,
    radius,
  }: {
    position: [number, number];
    radius: number;
  }) {
    this._position = position;
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

  createIndicies(): number[] | Float32Array {
    const numElements = 40;

    const indicies: number[] = [];
    indicies.concat(this.position);

    for (let i = 0; i <= numElements; i++) {
      const theta = (2 * Math.PI * i) / numElements;
      indicies.push(
        this.position[0] + this.radius * Math.cos(theta),
        this.position[1] + this.radius * Math.sin(theta),
      );
    }

    return indicies;
  }
}
