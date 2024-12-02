import { Drawable } from "./vdu";

export class Circle implements Drawable {
  private readonly _position: [number, number];
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

  createIndicies(): number[] | Float32Array {
    const numElements = 40;

    const indicies: number[] = [];
    indicies.concat(this.position);

    for (let i = 0; i <= numElements; i++) {
      const theta = (2 * Math.PI * i) / numElements;
      indicies.push(
        this.position[0] + this.radius * Math.cos(theta),
        this.position[1] + this.radius * Math.sin(theta)
      );
    }

    return indicies;
  }
}
