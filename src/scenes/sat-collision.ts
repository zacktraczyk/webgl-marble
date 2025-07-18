import { Arrow } from "../engine/object/arrow";
import { Line } from "../engine/object/line";
import {
  SATCollisionDetector,
  SATCollisionResolver,
} from "../engine/physics/collision/SAT";
import { PhysicsEntity, type Physical } from "../engine/physics/entity";
import Physics from "../engine/physics/physics";
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
  const physics = new Physics({
    collisionDetector: new SATCollisionDetector(),
    collisionResolver: new SATCollisionResolver(),
  });
  const stage = new Stage({ physics: physics });
  stage.dragAndDrop = true;
  stage.panAndZoom = true;
  stage.centerCameraOnResize = false;
  stage.drawMode = "TRIANGLES";

  const centerX = 0;
  const centerY = 0;
  const offset = 200;

  const circle1 = new DragAndDropCircle({
    position: [centerX + offset, centerY],
    radius: 50,
    color: [34 / 255, 197 / 255, 94 / 255, 1],
    handleRadius: 15,
    handleColor: [0.4, 0.4, 0.4, 1],
  });
  stage.add(circle1);

  const circle2 = new DragAndDropCircle({
    position: [centerX, centerY + offset],
    radius: 70,
    color: [167 / 255, 139 / 255, 250 / 255, 1],
    handleRadius: 15,
    handleColor: [0.4, 0.4, 0.4, 1],
  });
  stage.add(circle2);

  const hexagon1 = new DragAndDropHexagon({
    sideLength: 80,
    position: [centerX, centerY - offset],
    scale: [1, 1],
    color: [56 / 255, 189 / 255, 248 / 255, 1],
    handleRadius: 15,
    handleColor: [0.4, 0.4, 0.4, 1],
  });
  stage.add(hexagon1);

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

  let currentCollisions: {
    entity1: number;
    entity2: number;
    minimumTranslationVector: {
      normal: [number, number];
      magnitude: number;
    };
  }[] = [];

  let collisionEdges: Record<string, Line> = {};
  let minimumTranslationVectorArrows: Record<string, [Arrow, Arrow]> = {};
  stage.registerPhysicsObserver(async ({ collisions }) => {
    for (const collision of collisions) {
      const {
        entity1,
        entity2,
        edge,
        minimumTranslationVector: { normal, magnitude },
      } = collision;
      const collisionKey = [entity1, entity2].sort().join("-");
      if (edge) {
        if (!collisionEdges[collisionKey]) {
          const line = new Line({
            startPosition: edge[0],
            endPosition: edge[1],
            color: [252 / 255, 0 / 255, 147 / 255, 1],
          });
          stage.add(line);

          collisionEdges[collisionKey] = line;
        }

        collisionEdges[collisionKey].startPosition = edge[0];
        collisionEdges[collisionKey].endPosition = edge[1];
      }

      if (normal && magnitude) {
        if (!minimumTranslationVectorArrows[collisionKey]) {
          const arrow = new Arrow({
            basePosition: [0, 0],
            tipPosition: [1, 0],
            tipLength: 10,
            stroke: 4,
            color: [1, 1, 1, 1],
          });
          stage.add(arrow);

          const arrow2 = new Arrow({
            basePosition: [0, 0],
            tipPosition: [1, 0],
            tipLength: 10,
            stroke: 4,
            color: [1, 1, 1, 1],
          });
          stage.add(arrow2);
          minimumTranslationVectorArrows[collisionKey] = [arrow, arrow2];
        }

        // const mtvBasePosition = entity2.position;

        // const mtvTipPosition = [
        //   mtvBasePosition[0] + normal[0] * magnitude,
        //   mtvBasePosition[1] + normal[1] * magnitude,
        // ];

        minimumTranslationVectorArrows[collisionKey][0].basePosition = [
          entity2.position[0],
          entity2.position[1],
        ];
        minimumTranslationVectorArrows[collisionKey][0].tipPosition = [
          entity2.position[0] + normal[0] * magnitude,
          entity2.position[1] + normal[1] * magnitude,
        ];

        minimumTranslationVectorArrows[collisionKey][1].basePosition = [
          entity1.position[0],
          entity1.position[1],
        ];
        minimumTranslationVectorArrows[collisionKey][1].tipPosition = [
          entity1.position[0] - normal[0] * magnitude,
          entity1.position[1] - normal[1] * magnitude,
        ];
      }
    }

    currentCollisions = collisions.map((collision) => {
      const collisionDebug = {
        entity1: collision.entity1.parent.id,
        entity2: collision.entity2.parent.id,
        edge: collision.edge,
        minimumTranslationVector: collision.minimumTranslationVector,
      };

      return collisionDebug;
    });
  });

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    stage.update(elapsed);

    if (!currentCollisions.length) {
      for (const collisionKey in collisionEdges) {
        collisionEdges[collisionKey].delete();
      }

      for (const collisionKey in minimumTranslationVectorArrows) {
        minimumTranslationVectorArrows[collisionKey][0].delete();
        minimumTranslationVectorArrows[collisionKey][1].delete();
      }

      collisionEdges = {};
      minimumTranslationVectorArrows = {};
    }

    updateFpsPerf();
    updateDebugInfo({
      collisions: currentCollisions,
    });
    currentCollisions = [];
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

class DragAndDropRectangle implements Drawable, Physical, DragAndDroppable {
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

class DragAndDropCircle implements Drawable, Physical, DragAndDroppable {
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

class DragAndDropHexagon implements Drawable, Physical, DragAndDroppable {
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
