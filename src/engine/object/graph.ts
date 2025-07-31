import type { StageObject } from "../stage";
import { getNext } from "../utils/id";
import { createRectangle, type Drawable, type DrawEntity } from "../vdu/entity";
import { Arrow } from "./arrow";
import { Line } from "./line";
import { Point } from "./point";
import { Triangle } from "./triangle";

// TODO: Optimize!!
export class Graph implements Drawable {
  readonly id;
  private _position: [number, number];
  readonly width: number;
  readonly height: number;
  readonly scale: number; // Scale of graphObjects
  markedForDeletion: boolean = false;

  private _backgroundDrawEntity: DrawEntity | null = null;
  private _gridLines: Line[] = [];
  private _originPoint: Point | null = null;
  private _graphObjects: (StageObject & Drawable)[] = [];

  constructor({
    objects,
    position,
    width,
    height,
    scale,
  }: {
    objects?: (StageObject & Drawable)[];
    position: [number, number];
    width: number;
    height: number;
    scale?: number;
  }) {
    this.id = getNext();
    this._position = position;
    this.width = width;
    this.height = height;
    this.scale = scale ?? 0.5;

    this._graphObjects = this.duplicateObjects(objects ?? []);
  }

  duplicateObjects(objects: (StageObject & Drawable)[]) {
    const newObjects: (StageObject & Drawable)[] = [];
    for (let i = 0; i < objects.length; i++) {
      const object = objects[i];
      if (object instanceof Triangle) {
        const verts = object.vertices.map((vert) => [
          vert[0] * this.scale,
          vert[1] * this.scale,
        ]);
        const newObject = new Triangle({
          vertices: [
            [verts[0][0] + this._position[0], verts[0][1] + this._position[1]],
            [verts[1][0] + this._position[0], verts[1][1] + this._position[1]],
            [verts[2][0] + this._position[0], verts[2][1] + this._position[1]],
          ],
          color: object.color,
        });
        newObjects.push(newObject);
      }
      if (object instanceof Arrow) {
        const basePosition: [number, number] = [
          this._position[0] + object.basePosition[0] * this.scale,
          this._position[1] + object.basePosition[1] * this.scale,
        ];
        const tipPosition: [number, number] = [
          this._position[0] + object.tipPosition[0] * this.scale,
          this._position[1] + object.tipPosition[1] * this.scale,
        ];
        const newObject = new Arrow({
          basePosition: basePosition,
          tipPosition: tipPosition,
          tipLength: object.tipLength * this.scale,
          stroke: object.stroke * this.scale,
          color: object.color,
        });
        newObjects.push(newObject);
      }
      if (object instanceof Line) {
        const startPosition: [number, number] = [
          this._position[0] + object.startPosition[0] * this.scale,
          this._position[1] + object.startPosition[1] * this.scale,
        ];
        const endPosition: [number, number] = [
          this._position[0] + object.endPosition[0] * this.scale,
          this._position[1] + object.endPosition[1] * this.scale,
        ];
        const newObject = new Line({
          startPosition: startPosition,
          endPosition: endPosition,
          color: object.color,
          stroke: object.stroke * this.scale,
        });
        newObjects.push(newObject);
      }
      if (object instanceof Point) {
        const newObject = new Point({
          radius: object.radius * this.scale,
          position: [
            this._position[0] + object.position[0] * this.scale,
            this._position[1] + object.position[1] * this.scale,
          ],
          color: object.color,
        });
        newObjects.push(newObject);
      }
    }
    return newObjects;
  }

  delete() {
    if (this.markedForDeletion) {
      console.warn("Could not delete rectangle: already marked for deletion");
      return;
    }
    if (this._backgroundDrawEntity) {
      this._backgroundDrawEntity.delete();
    }
    if (this._gridLines.length) {
      this._gridLines.forEach((line) => {
        line.delete();
      });
    }
    if (this._originPoint) {
      this._originPoint.delete();
    }
    this._graphObjects.forEach((object) => {
      object.delete();
    });
    this.markedForDeletion = true;
  }

  private _numMajorGridColumns = 2;
  private _numMajorGridRows = 2;
  createGridLines() {
    for (
      let i = 0;
      i < this._numMajorGridRows + this._numMajorGridColumns - 2;
      i++
    ) {
      const line = new Line({
        startPosition: [0, 0],
        endPosition: [0, 0],
        color: [0.2, 0.2, 0.2, 1],
        stroke: 1.2,
      });
      this._gridLines.push(line);
    }
    this.syncGridLines();
  }

  // TODO: Implement
  syncGridLines() {
    if (
      this._gridLines.length !==
      this._numMajorGridRows + this._numMajorGridColumns - 2
    ) {
      throw new Error("Grid lines are not in sync");
    }

    const [offsetX, offsetY] = this.position;
    const gridSizeY = this.height / this._numMajorGridRows;
    for (let i = 0; i < this._numMajorGridRows - 1; i++) {
      const line = this._gridLines[i];
      line.startPosition = [
        offsetX - this.width / 2,
        offsetY + (i + 1) * gridSizeY - this.height / 2,
      ];
      line.endPosition = [
        offsetX + this.width / 2,
        offsetY + (i + 1) * gridSizeY - this.height / 2,
      ];
    }

    const gridSizeX = this.width / this._numMajorGridColumns;
    for (let i = 1; i < this._numMajorGridColumns; i++) {
      const line = this._gridLines[i];
      line.startPosition = [
        offsetX + i * gridSizeX - this.width / 2,
        offsetY - this.height / 2,
      ];
      line.endPosition = [
        offsetX + i * gridSizeX - this.width / 2,
        offsetY + this.height / 2,
      ];
    }

    this._gridLines.forEach((line) => {
      line.sync();
    });
  }

  get drawEntities() {
    if (!this._backgroundDrawEntity) {
      const entity = createRectangle({
        parent: this,
        width: this.width,
        height: this.height,
      });
      entity.color = [0.8, 0.8, 0.8, 1];
      this._backgroundDrawEntity = entity;
    }

    if (this._gridLines.length === 0) {
      this.createGridLines();
    }
    const gridLineDrawEntities = this._gridLines.flatMap(
      (line) => line.drawEntities
    );

    if (!this._originPoint) {
      this._originPoint = new Point({
        radius: 4,
        position: this._position,
        color: [0, 1, 0, 1],
      });
    }

    const graphObjectDrawEntities = this._graphObjects.flatMap(
      (object) => object.drawEntities
    );

    return [
      this._backgroundDrawEntity,
      ...gridLineDrawEntities,
      ...this._originPoint.drawEntities,
      ...graphObjectDrawEntities,
    ];
  }

  get position() {
    return this._position;
  }

  set position(position: [number, number]) {
    console.error("Not implemented");
    // this._position = position;
    // if (this._backgroundDrawEntity) {
    //   this._backgroundDrawEntity.position = position;
    // }
  }

  sync() {
    if (this._backgroundDrawEntity) {
      this._backgroundDrawEntity.position = this._position;
    }
    this.syncGridLines();
    if (this._originPoint) {
      this._originPoint.position = this._position;
      this._originPoint.sync();
    }
    this._graphObjects.forEach((object) => {
      object.sync();
    });
  }
}
