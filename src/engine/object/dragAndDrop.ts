import { PhysicsEntity, type Physical } from "../physics/entity";
import type { DragAndDroppable } from "../stage/eventHandlers";
import { getNext } from "../utils/id";
import {
  createCircle,
  createHexagon,
  createRectangle,
  type Drawable,
  type DrawEntity,
} from "../vdu/entity";

export class DragAndDropRectangle
  implements Drawable, Physical, DragAndDroppable
{
  readonly id;
  readonly width: number;
  readonly height: number;
  rotation: number;
  scale: [number, number];
  color: [number, number, number, number];
  private _position: [number, number];
  markedForDeletion: boolean = false;
  grabHandleRadius: number;
  grabHandleColor: [number, number, number, number];

  private _rectangleDrawEntity: DrawEntity | null = null;
  private _grabHandleDrawEntity: DrawEntity | null = null;

  private _physicsEntity: PhysicsEntity | null = null;

  constructor({
    width,
    height,
    position,
    rotation,
    scale,
    color,

    handleRadius,
    handleColor,
  }: {
    width: number;
    height: number;
    position: [number, number];
    rotation: number;
    scale?: [number, number];
    color?: [number, number, number, number];
    handleRadius: number;
    handleColor: [number, number, number, number];
  }) {
    this.id = getNext();
    this.width = width;
    this.height = height;
    this.rotation = rotation;
    this.scale = scale ?? [1, 1];
    this.color = color ?? [1, 1, 1, 1];
    this._position = position;
    this.grabHandleRadius = handleRadius;
    this.grabHandleColor = handleColor;
  }

  get position() {
    return this._position;
  }

  set position(value: [number, number]) {
    if (this._physicsEntity) {
      this._physicsEntity.position = value;
    }
    this._position = value;
  }

  get physicsEntity(): PhysicsEntity {
    if (!this._physicsEntity) {
      this._physicsEntity = new PhysicsEntity({
        parent: this,
        type: "kinematic",
        position: this._position,
        rotation: this.rotation,
        boundingShape: {
          type: "BoundingConvexPolygon",
          position: this._position,
          vertices: [
            [-this.width / 2, -this.height / 2],
            [this.width / 2, -this.height / 2],
            [this.width / 2, this.height / 2],
            [-this.width / 2, this.height / 2],
          ],
        },
      });
    }

    return this._physicsEntity;
  }

  get drawEntities() {
    if (!this._rectangleDrawEntity) {
      const entity = createRectangle({
        parent: this,
        width: this.width,
        height: this.height,
      });
      this._rectangleDrawEntity = entity;
    }

    if (!this._grabHandleDrawEntity) {
      const entity = createCircle(this, this.grabHandleRadius);
      this._grabHandleDrawEntity = entity;
    }

    return [this._rectangleDrawEntity, this._grabHandleDrawEntity];
  }

  delete() {
    if (this._rectangleDrawEntity) {
      this._rectangleDrawEntity.delete();
    }
    if (this._grabHandleDrawEntity) {
      this._grabHandleDrawEntity.delete();
    }
  }

  sync() {
    if (this._physicsEntity) {
      this.position = this._physicsEntity.position;
      this.rotation = this._physicsEntity.rotation;
    }

    if (this._rectangleDrawEntity) {
      this._rectangleDrawEntity.position = this.position;
      this._rectangleDrawEntity.rotation = this.rotation;
      this._rectangleDrawEntity.scale = this.scale;
      this._rectangleDrawEntity.color = this.color;
    }
    if (this._grabHandleDrawEntity) {
      this._grabHandleDrawEntity.position = this.position;
      this._grabHandleDrawEntity.color = this.grabHandleColor;
    }
  }
}

export class DragAndDropCircle implements Drawable, Physical, DragAndDroppable {
  readonly id;
  readonly radius: number;
  scale: [number, number];
  color: [number, number, number, number];
  private _position: [number, number];
  private _circleDrawEntity: DrawEntity | null = null;

  readonly grabHandleRadius: number;
  grabHandleColor: [number, number, number, number];
  private _grabHandleDrawEntity: DrawEntity | null = null;

  private _physicsEntity: PhysicsEntity | null = null;

  markedForDeletion: boolean = false;

  constructor({
    radius,
    position,
    scale,
    color,

    handleRadius,
    handleColor,
  }: {
    radius: number;
    position: [number, number];
    scale?: [number, number];
    color?: [number, number, number, number];

    handleRadius: number;
    handleColor: [number, number, number, number];
  }) {
    this.id = getNext();
    this.radius = radius;
    this._position = position;
    this.scale = scale ?? [1, 1];
    this.color = color ?? [1, 1, 1, 1];

    this.grabHandleRadius = handleRadius;
    this.grabHandleColor = handleColor;
  }

  get position() {
    return this._position;
  }

  set position(value: [number, number]) {
    if (this._physicsEntity) {
      this._physicsEntity.position = value;
    }
    this._position = value;
  }

  get physicsEntity(): PhysicsEntity {
    if (!this._physicsEntity) {
      this._physicsEntity = new PhysicsEntity({
        parent: this,
        type: "kinematic",
        position: this._position,
        boundingShape: {
          type: "BoundingCircle",
          position: this._position,
          radius: this.radius,
        },
      });
    }

    return this._physicsEntity;
  }

  get drawEntities() {
    if (!this._circleDrawEntity) {
      const entity = createCircle(this, this.radius);
      this._circleDrawEntity = entity;
    }

    if (!this._grabHandleDrawEntity) {
      const entity = createCircle(this, this.grabHandleRadius);
      this._grabHandleDrawEntity = entity;
    }

    return [this._circleDrawEntity, this._grabHandleDrawEntity];
  }

  delete() {
    if (this._circleDrawEntity) {
      this._circleDrawEntity.delete();
    }
    if (this._grabHandleDrawEntity) {
      this._grabHandleDrawEntity.delete();
    }
  }

  sync() {
    if (this._circleDrawEntity) {
      this._circleDrawEntity.position = this.position;
      this._circleDrawEntity.scale = this.scale;
      this._circleDrawEntity.color = this.color;
    }

    if (this._grabHandleDrawEntity) {
      this._grabHandleDrawEntity.position = this.position;
      this._grabHandleDrawEntity.color = this.grabHandleColor;
    }
  }
}

export class DragAndDropHexagon
  implements Drawable, Physical, DragAndDroppable
{
  readonly id;
  readonly sideLength: number;
  scale: [number, number];
  color: [number, number, number, number];
  private _position: [number, number];
  private _pentagonDrawEntity: DrawEntity | null = null;

  private _grabHandleDrawEntity: DrawEntity | null = null;
  readonly grabHandleRadius: number;
  grabHandleColor: [number, number, number, number];

  private _physicsEntity: PhysicsEntity | null = null;

  markedForDeletion: boolean = false;

  constructor({
    sideLength,
    position,
    scale,
    color,

    handleRadius,
    handleColor,
  }: {
    sideLength: number;
    position: [number, number];
    scale?: [number, number];
    color?: [number, number, number, number];
    handleRadius: number;
    handleColor: [number, number, number, number];
  }) {
    this.id = getNext();
    this.sideLength = sideLength;
    this._position = position;
    this.scale = scale ?? [1, 1];
    this.color = color ?? [1, 1, 1, 1];
    this.grabHandleRadius = handleRadius;
    this.grabHandleColor = handleColor;
  }

  get position() {
    return this._position;
  }

  set position(value: [number, number]) {
    if (this._physicsEntity) {
      this._physicsEntity.position = value;
    }
    this._position = value;
  }

  get physicsEntity(): PhysicsEntity {
    const vertices: [number, number][] = [
      [this.sideLength, 0],
      [this.sideLength * (1 / 2), this.sideLength * (Math.sqrt(3) / 2)],
      [this.sideLength * -(1 / 2), this.sideLength * (Math.sqrt(3) / 2)],
      [-this.sideLength, 0],
      [this.sideLength * -(1 / 2), -this.sideLength * (Math.sqrt(3) / 2)],
      [this.sideLength * (1 / 2), -this.sideLength * (Math.sqrt(3) / 2)],
    ];
    if (!this._physicsEntity) {
      this._physicsEntity = new PhysicsEntity({
        parent: this,
        type: "kinematic",
        position: this._position,
        boundingShape: {
          type: "BoundingConvexPolygon",
          position: this._position,
          vertices,
        },
      });
    }

    return this._physicsEntity;
  }

  get drawEntities() {
    if (!this._pentagonDrawEntity) {
      const entity = createHexagon(this, this.sideLength);
      this._pentagonDrawEntity = entity;
    }

    if (!this._grabHandleDrawEntity) {
      const entity = createCircle(this, this.grabHandleRadius);
      this._grabHandleDrawEntity = entity;
    }

    return [this._pentagonDrawEntity, this._grabHandleDrawEntity];
  }

  delete() {
    if (this._pentagonDrawEntity) {
      this._pentagonDrawEntity.delete();
    }
    if (this._grabHandleDrawEntity) {
      this._grabHandleDrawEntity.delete();
    }
  }

  sync() {
    if (this._pentagonDrawEntity) {
      this._pentagonDrawEntity.position = this.position;
      this._pentagonDrawEntity.scale = this.scale;
      this._pentagonDrawEntity.color = this.color;
    }

    if (this._grabHandleDrawEntity) {
      this._grabHandleDrawEntity.position = this.position;
      this._grabHandleDrawEntity.color = this.grabHandleColor;
    }
  }
}
