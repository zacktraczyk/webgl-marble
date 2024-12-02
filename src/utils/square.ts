import { Drawable } from "./vdu";

export class Square implements Drawable {
  private readonly _position: [number, number];
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

  createIndicies(): number[] | Float32Array {
    const indicies: number[] = [];
    indicies.concat(this.position);

    indicies.push(
      this.position[0] + this.width * -(1 / 2),
      this.position[1] + this.width * -(1 / 2)
    );

    indicies.push(
      this.position[0] + this.width * (1 / 2),
      this.position[1] + this.width * -(1 / 2)
    );

    indicies.push(
      this.position[0] + this.width * (1 / 2),
      this.position[1] + this.width * (1 / 2)
    );

    indicies.push(
      this.position[0] + this.width * -(1 / 2),
      this.position[1] + this.width * (1 / 2)
    );

    return indicies;
  }
}
