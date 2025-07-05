import * as id from "../utils/id";
import {
  createRectangleOriginLeftCenter,
  type Drawable,
  DrawEntity,
} from "../vdu/entity";

export class Line implements Drawable {
  readonly id;
  startPosition: [number, number];
  endPosition: [number, number];
  stroke: number;
  color: [number, number, number, number] = [1, 0, 0, 1];
  // Considering arrow pointing right
  private _lineDrawEntity: DrawEntity | null = null;
  markedForDeletion: boolean = false;

  constructor({
    startPosition,
    endPosition,
    stroke = 4,
    color = [0, 0, 0, 1],
  }: {
    startPosition: [number, number];
    endPosition: [number, number];
    stroke?: number;
    color?: [number, number, number, number];
  }) {
    this.id = id.getNext();
    this.startPosition = startPosition;
    this.endPosition = endPosition;
    this.stroke = stroke;
    this.color = color;
  }

  delete() {
    if (this.markedForDeletion) {
      console.warn("Could not delete arrow: already marked for deletion");
      return;
    }
    if (this._lineDrawEntity) {
      this._lineDrawEntity.delete();
    }
    this.markedForDeletion = true;
  }

  get drawEntities() {
    if (!this._lineDrawEntity) {
      const entity = createRectangleOriginLeftCenter({
        parent: this,
        width: 1,
        height: 1,
      });
      this._lineDrawEntity = entity;
    }
    return [this._lineDrawEntity];
  }

  get position() {
    return this.startPosition;
  }

  get rotation() {
    return Math.atan2(
      this.endPosition[1] - this.startPosition[1],
      this.endPosition[0] - this.startPosition[0]
    );
  }

  sync() {
    if (this._lineDrawEntity) {
      this._lineDrawEntity.rotation = this.rotation;
      this._lineDrawEntity.position = this.position;
      this._lineDrawEntity.scale = [this.length, this.stroke];
      this._lineDrawEntity.color = this.color;
    }
  }

  get length() {
    return Math.sqrt(
      Math.pow(this.endPosition[0] - this.startPosition[0], 2) +
        Math.pow(this.endPosition[1] - this.startPosition[1], 2)
    );
  }

  get slope() {
    return (
      (this.endPosition[1] - this.startPosition[1]) /
      (this.endPosition[0] - this.startPosition[0])
    );
  }
}
