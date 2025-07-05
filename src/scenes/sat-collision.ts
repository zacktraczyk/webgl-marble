import { Line } from "../engine/object/line";
import { PhysicsEntity, type Physical } from "../engine/physics/entitySAT";
import Physics from "../engine/physics/physicsSAT";
import Stage from "../engine/stage";
import { type DragAndDroppable } from "../engine/stage/eventHandlers";
import { getNext } from "../engine/utils/id";
import {
  createCircle,
  createHexagon,
  createRectangle,
  type Drawable,
  type DrawEntity,
} from "../engine/vdu/entity";

function main() {
  const stage = new Stage();
  stage.dragAndDrop = true;
  stage.panAndZoom = true;
  stage.drawMode = "TRIANGLES";
  stage.physicsEnabled = false;

  // SAT Physics
  const physicsSAT = new Physics();

  const centerX = stage.canvas.clientWidth / 2;
  const centerY = stage.canvas.clientHeight / 2;
  const offset = 200;

  const circle1 = new DragAndDropCircle({
    position: [centerX + offset, centerY],
    radius: 50,
    color: [34 / 255, 197 / 255, 94 / 255, 1],
    handleRadius: 15,
    handleColor: [0.4, 0.4, 0.4, 1],
  });
  stage.add(circle1);
  physicsSAT.add(circle1);

  const square1 = new DragAndDropRectangle({
    position: [centerX - offset, centerY],
    width: 100,
    height: 100,
    scale: [1, 1],
    rotation: Math.PI / 8,
    color: [239 / 255, 68 / 255, 68 / 255, 1],
    handleRadius: 15,
    handleColor: [0.4, 0.4, 0.4, 1],
  });
  stage.add(square1);
  physicsSAT.add(square1);

  const hexagon1 = new DragAndDropHexagon({
    sideLength: 80,
    position: [centerX, centerY - offset],
    scale: [1, 1],
    color: [56 / 255, 189 / 255, 248 / 255, 1],
    handleRadius: 15,
    handleColor: [0.4, 0.4, 0.4, 1],
  });
  stage.add(hexagon1);
  physicsSAT.add(hexagon1);

  let debugSlope: Line | null = null;
  let debugEdge: Line | null = null;

  let debugAxis: Line | null = null;
  let debugAxisProj1: Line | null = null;
  let debugAxisProj2: Line | null = null;
  physicsSAT.register(({ type, ...data }) => {
    if (type !== "debug-sat" || !("data" in data)) {
      return;
    }

    const { slope, edge, proj1, proj2 } = data.data;
    if (!debugSlope) {
      // Draw a line through the center of the canvas with slope
      const centerX = stage.canvas.clientWidth / 2;
      const centerY = stage.canvas.clientHeight / 2;

      const startX = centerX - 100;
      const startY = slope * (startX - centerX) + centerY;

      const endX = centerX + 100;
      const endY = slope * (endX - centerX) + centerY;

      const lineDrawEntity = new Line({
        startPosition: [startX, startY],
        endPosition: [endX, endY],
        stroke: 2,
        color: [1, 1, 1, 1],
      });
      stage.add(lineDrawEntity);
      debugSlope = lineDrawEntity;
    }

    if (!debugAxis) {
      const posY = centerY + 300;
      const axisLength = 300;

      const startPosition: [number, number] = [centerX - axisLength / 2, posY];
      const endPosition: [number, number] = [centerX + axisLength / 2, posY];

      const lineDrawEntity = new Line({
        startPosition: startPosition,
        endPosition: endPosition,
        stroke: 2,
        color: [1, 1, 1, 1],
      });
      stage.add(lineDrawEntity);
      debugAxis = lineDrawEntity;

      const proj1OffsetY = posY - 50;
      const proj1StartPosition: [number, number] = [
        startPosition[0] + proj1[0] * axisLength,
        proj1OffsetY,
      ];
      const proj1EndPosition: [number, number] = [
        startPosition[0] + proj1[1] * axisLength,
        proj1OffsetY,
      ];
      const proj1LineDrawEntity = new Line({
        startPosition: proj1StartPosition,
        endPosition: proj1EndPosition,
        stroke: 2,
        color: [0, 0.2, 0.2, 1],
      });
      stage.add(proj1LineDrawEntity);

      const proj2OffsetY = posY - 100;
      const proj2StartPosition: [number, number] = [
        startPosition[0] + proj2[0] * axisLength,
        proj2OffsetY,
      ];
      const proj2EndPosition: [number, number] = [
        startPosition[0] + proj2[1] * axisLength,
        proj2OffsetY,
      ];

      const proj2LineDrawEntity = new Line({
        startPosition: proj2StartPosition,
        endPosition: proj2EndPosition,
        stroke: 2,
        color: [0, 0.2, 0.2, 1],
      });
      stage.add(proj2LineDrawEntity);
    }

    if (!debugEdge) {
      const lineDrawEntity = new Line({
        startPosition: edge[0],
        endPosition: edge[1],
        stroke: 2,
        color: [187 / 255, 27 / 255, 219 / 255, 0.8],
      });
      stage.add(lineDrawEntity);
      debugEdge = lineDrawEntity;
    }
  });

  let collisions: [string, string][] = [];
  physicsSAT.register(({ type, ...data }) => {
    if (type !== "collision" || !("collisions" in data)) {
      return;
    }
    const newCollisions = data.collisions;
    collisions = newCollisions.map((collision) => [
      collision.entity1.parent.name,
      collision.entity2.parent.name,
    ]);
  });

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    stage.update(elapsed);
    physicsSAT.update(elapsed);
    updateFpsPerf();
    updateDebugInfo({
      collisions,
    });
    collisions = [];
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

class DragAndDropRectangle implements Drawable, Physical, DragAndDroppable {
  readonly name: string;
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
    this.name = "rectangle";
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

class DragAndDropCircle implements Drawable, Physical, DragAndDroppable {
  readonly name: string;
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
    this.name = "circle";
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

class DragAndDropHexagon implements Drawable, Physical, DragAndDroppable {
  readonly name: string;
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
    this.name = "hexagon";
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

// Debug info
const debugInfoElem = document.getElementById("#debug-info");
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const updateDebugInfo = (obj: any) => {
  if (debugInfoElem) {
    debugInfoElem.textContent = JSON.stringify(obj, null, 2);
  }
};

// FPS Counter
const fpsElem = document.getElementById("#fps");
let lastTime = performance.now();
let frameCount = 0;
const updateFpsPerf = () => {
  const now = performance.now();
  const delta = now - lastTime;
  frameCount++;

  if (delta > 500) {
    const fps = (frameCount / delta) * 1000;
    if (fpsElem) {
      fpsElem.textContent = `FPS: ${fps.toFixed(2)}`;
    }
    lastTime = now;
    frameCount = 0;
  }
};

export default main;
