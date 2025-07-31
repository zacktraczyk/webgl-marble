import { getNext } from "../utils/id";
import type { Drawable, DrawEntity } from "../vdu/entity";
import { Line } from "./line";

// TODO: Optimize!!
export class Triangle implements Drawable {
  readonly id;
  readonly vertices: [[number, number], [number, number], [number, number]];
  readonly color: [number, number, number, number];
  private _rotation: number; // radians
  private _scale: [number, number];
  private _position: [number, number];

  private _line1: Line | null = null;
  private _line2: Line | null = null;
  private _line3: Line | null = null;
  markedForDeletion: boolean = false;

  constructor({
    vertices,
    color,
  }: {
    vertices: [[number, number], [number, number], [number, number]];
    color: [number, number, number, number];
  }) {
    this.id = getNext();
    // NOTE: Vertices must be in counter-clockwise order
    this.vertices = [...vertices];
    this.color = color;
    this._rotation = 0;
    this._scale = [1, 1];
    this._position = [0, 0];
  }

  get position() {
    return this._position;
  }

  set position(position: [number, number]) {
    throw new Error("Cannot set position of Triangle");
  }

  get rotation() {
    return this._rotation;
  }

  set rotation(rotation: number) {
    throw new Error("Cannot set rotation of Triangle");
  }

  get scale() {
    return this._scale;
  }

  set scale(scale: [number, number]) {
    throw new Error("Cannot set scale of Triangle");
  }

  get drawEntities(): DrawEntity[] {
    if (!this._line1) {
      this._line1 = new Line({
        startPosition: this.vertices[0],
        endPosition: this.vertices[1],
        color: this.color,
        stroke: 2,
      });
    }
    if (!this._line2) {
      this._line2 = new Line({
        startPosition: this.vertices[1],
        endPosition: this.vertices[2],
        color: this.color,
        stroke: 2,
      });
    }
    if (!this._line3) {
      this._line3 = new Line({
        startPosition: this.vertices[2],
        endPosition: this.vertices[0],
        color: this.color,
        stroke: 2,
      });
    }

    return [
      ...this._line1.drawEntities,
      ...this._line2.drawEntities,
      ...this._line3.drawEntities,
    ];
  }

  delete() {
    if (this._line1) {
      this._line1.delete();
    }
    if (this._line2) {
      this._line2.delete();
    }
    if (this._line3) {
      this._line3.delete();
    }
  }

  sync() {
    if (this._line1) {
      this._line1.startPosition = this.vertices[0];
      this._line1.endPosition = this.vertices[1];
      this._line1.color = this.color;
      this._line1.sync();
    }
    if (this._line2) {
      this._line2.startPosition = this.vertices[1];
      this._line2.endPosition = this.vertices[2];
      this._line2.color = this.color;
      this._line2.sync();
    }
    if (this._line3) {
      this._line3.startPosition = this.vertices[2];
      this._line3.endPosition = this.vertices[0];
      this._line3.color = this.color;
      this._line3.sync();
    }
  }
}
