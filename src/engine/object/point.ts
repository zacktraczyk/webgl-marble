import { getNext } from "../utils/id";
import type { Drawable, DrawEntity } from "../vdu/entity";
import { createCircle } from "../vdu/entity";

export class Point implements Drawable {
  readonly id;
  readonly radius: number;
  private _position: [number, number];
  rotation: number; // radians
  scale: [number, number];
  color: [number, number, number, number] = [1, 0, 0, 1];
  private _drawEntity: DrawEntity | null = null;
  markedForDeletion: boolean = false;

  constructor({
    radius,
    position,
    rotation,
    scale,
    color,
  }: {
    radius: number;
    position: [number, number];
    rotation?: number;
    scale?: [number, number];
    color?: [number, number, number, number];
    velocity?: [number, number];
  }) {
    this.id = getNext();
    this.radius = radius;
    this._position = position;
    this.rotation = rotation ?? 0;
    this.scale = scale ?? [1, 1];
    this.color = color ?? [1, 1, 1, 1];
  }

  delete() {
    if (this.markedForDeletion) {
      console.warn("Could not delete rectangle: already marked for deletion");
      return;
    }
    if (this._drawEntity) {
      this._drawEntity.delete();
    }
    this.markedForDeletion = true;
  }

  get drawEntities() {
    if (!this._drawEntity) {
      const entity = createCircle(this, this.radius);
      this._drawEntity = entity;
    }

    return [this._drawEntity];
  }

  get position() {
    return this._position;
  }

  set position(position: [number, number]) {
    this._position = position;
    if (this._drawEntity) {
      this._drawEntity.position = position;
    }
  }

  sync() {
    if (this._drawEntity) {
      this._drawEntity.position = this._position;
      this._drawEntity.rotation = this.rotation;
      this._drawEntity.scale = this.scale;
      this._drawEntity.color = this.color;
    }
  }
}
