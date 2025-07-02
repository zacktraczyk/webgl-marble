import * as id from "../utils/id";
import { createRectangle, type Drawable, DrawEntity } from "../vdu/entity";

export class Arrow implements Drawable {
  readonly id;
  basePosition: [number, number];
  tipPosition: [number, number];
  tipLength: number;
  stroke: number;
  color: [number, number, number, number] = [1, 0, 0, 1];
  // Considering arrow pointing right
  private _tipTopEntity: DrawEntity | null = null;
  private _tipBottomEntity: DrawEntity | null = null;
  private _baseEntity: DrawEntity | null = null;
  markedForDeletion: boolean = false;

  constructor({
    basePosition,
    tipPosition,
    tipLength = 20,
    stroke = 4,
    color = [0, 0, 0, 1],
  }: {
    basePosition: [number, number];
    tipPosition: [number, number];
    tipLength?: number;
    stroke?: number;
    color?: [number, number, number, number];
  }) {
    this.id = id.getNext();
    this.basePosition = basePosition;
    this.tipPosition = tipPosition;
    this.tipLength = tipLength;
    this.stroke = stroke;
    this.color = color;
  }

  delete() {
    if (this.markedForDeletion) {
      console.warn("Could not delete arrow: already marked for deletion");
      return;
    }
    if (this._tipTopEntity) {
      this._tipTopEntity.delete();
    }
    if (this._tipBottomEntity) {
      this._tipBottomEntity.delete();
    }
    if (this._baseEntity) {
      this._baseEntity.delete();
    }
    this.markedForDeletion = true;
  }

  get drawEntities() {
    if (!this._tipTopEntity) {
      const entity = createRectangle({
        parent: this,
        width: 1,
        height: 1,
      });
      this._tipTopEntity = entity;
    }
    if (!this._tipBottomEntity) {
      const entity = createRectangle({
        parent: this,
        width: 1,
        height: 1,
      });
      this._tipBottomEntity = entity;
    }
    if (!this._baseEntity) {
      const entity = createRectangle({
        parent: this,
        width: 1,
        height: 1,
      });
      this._baseEntity = entity;
    }

    return [this._tipTopEntity, this._tipBottomEntity, this._baseEntity];
  }

  get position() {
    return this.tipPosition;
  }

  get rotation() {
    return Math.atan2(
      this.tipPosition[1] - this.basePosition[1],
      this.tipPosition[0] - this.basePosition[0]
    );
  }

  sync() {
    const tipAngle = Math.PI / 4;

    // TODO: Use rotation and scale
    if (this._tipTopEntity) {
      const scale: [number, number] = [this.tipLength, this.stroke];
      const pos: [number, number] = [
        this.tipPosition[0],
        this.tipPosition[1] - this.tipLength / 2,
      ];
      const rotation = Math.atan2(
        this.tipPosition[1] - this.basePosition[1],
        this.tipPosition[0] - this.basePosition[0]
      );

      this._tipTopEntity.rotation = rotation + tipAngle;
      this._tipTopEntity.scale = scale;
      this._tipTopEntity.position = pos;
    }
    if (this._tipBottomEntity) {
      const scale: [number, number] = [this.tipLength, this.stroke];
      const pos: [number, number] = [
        this.tipPosition[0],
        this.tipPosition[1] + this.tipLength / 2,
      ];
      const rotation = Math.atan2(
        this.tipPosition[1] - this.basePosition[1],
        this.tipPosition[0] - this.basePosition[0]
      );

      this._tipBottomEntity.rotation = rotation - tipAngle;
      this._tipBottomEntity.scale = scale;
      this._tipBottomEntity.position = pos;
    }
    if (this._baseEntity) {
      const scale: [number, number] = [this.length, this.stroke];
      const pos: [number, number] = [
        (this.tipPosition[0] + this.basePosition[0]) / 2,
        (this.tipPosition[1] + this.basePosition[1]) / 2,
      ];
      const rotation = Math.atan2(
        this.basePosition[1] - this.tipPosition[1],
        this.basePosition[0] - this.tipPosition[0]
      );

      this._baseEntity.rotation = rotation;
      this._baseEntity.scale = scale;
      this._baseEntity.position = pos;
    }
  }

  // helper

  get length() {
    return Math.sqrt(
      Math.pow(this.tipPosition[0] - this.basePosition[0], 2) +
        Math.pow(this.tipPosition[1] - this.basePosition[1], 2)
    );
  }
}
