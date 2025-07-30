import { Arrow } from "../engine/object/arrow";
import { Line } from "../engine/object/line";
import { Rectangle } from "../engine/object/rectangle";
import { GJKCollisionDetector } from "../engine/physics/collision/GJK";
import { SATCollisionResolver } from "../engine/physics/collision/SAT";
import { PhysicsEntity, type Physical } from "../engine/physics/entity";
import Physics from "../engine/physics/physics";
import Stage, { type StageObject } from "../engine/stage";
import { type DragAndDroppable } from "../engine/stage/eventHandlers";
import { getNext } from "../engine/utils/id";
import {
  createCircle,
  createHexagon,
  createRectangle,
  type Drawable,
  DrawEntity,
} from "../engine/vdu/entity";

function main() {
  // Initialize
  const gjkCollisionDetector = new GJKCollisionDetector();
  const physics = new Physics({
    collisionDetector: gjkCollisionDetector,
    collisionResolver: new SATCollisionResolver(),
  });
  const stage = new Stage({ physics: physics });
  stage.dragAndDrop = true;
  stage.panAndZoom = true;
  stage.centerCameraOnResize = false;
  stage.drawMode = "TRIANGLES";

  const numMajorGridColumns = 8;
  const numMajorGridRows = 8;
  const gridLines: Record<string, Line> = {};
  const createGridLines = () => {
    const gridSizeY = stage.canvas.clientHeight / numMajorGridRows;
    for (let i = 1; i < numMajorGridRows; i++) {
      const id = "row-" + i;
      if (!gridLines[id]) {
        const line = new Line({
          startPosition: [
            0 - stage.canvas.clientWidth / 2,
            i * gridSizeY - stage.canvas.clientHeight / 2,
          ],
          endPosition: [
            stage.canvas.clientWidth / 2,
            i * gridSizeY - stage.canvas.clientHeight / 2,
          ],
          color: [0.1, 0.1, 0.1, 0.5],
          stroke: 2,
        });
        stage.add(line);
        gridLines[id] = line;
      }
    }

    const gridSizeX = stage.canvas.clientWidth / numMajorGridColumns;
    for (let i = 1; i < numMajorGridColumns; i++) {
      const id = "column-" + i;
      if (!gridLines[id]) {
        const line = new Line({
          startPosition: [
            i * gridSizeX - stage.canvas.clientWidth / 2,
            0 - stage.canvas.clientHeight / 2,
          ],
          endPosition: [
            i * gridSizeX - stage.canvas.clientWidth / 2,
            stage.canvas.clientHeight / 2,
          ],
          color: [0.1, 0.1, 0.1, 0.5],
          stroke: 2,
        });
        stage.add(line);
        gridLines[id] = line;
      }
    }
  };

  createGridLines();

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

  // const circle2 = new DragAndDropCircle({
  //   position: [centerX, centerY + offset],
  //   radius: 70,
  //   color: [167 / 255, 139 / 255, 250 / 255, 1],
  //   handleRadius: 15,
  //   handleColor: [0.4, 0.4, 0.4, 1],
  // });
  // stage.add(circle2);

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

      if (edge && edge.length === 2) {
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

  const MIN_PADDING = 20;
  const GRAPH_WIDTH = 200;
  const GRAPH_HEIGHT = 200;
  const NUM_COLS = Math.floor(
    (stage.canvas.clientWidth - MIN_PADDING) / (GRAPH_WIDTH + MIN_PADDING)
  );
  const COL_SPACING = stage.canvas.clientWidth / NUM_COLS;
  const START_X = -stage.canvas.clientWidth / 2 + COL_SPACING / 2;
  const START_Y =
    stage.canvas.clientHeight / 2 -
    GRAPH_HEIGHT / 2 -
    (COL_SPACING - GRAPH_WIDTH);

  let debugGraphs: Graph[] = [];
  const addDebugGraph = (objects: (StageObject & Drawable)[]) => {
    const i = debugGraphs.length;
    const x = START_X + (i % NUM_COLS) * COL_SPACING;
    const y = START_Y + Math.floor(i / NUM_COLS) * COL_SPACING;
    const graph = new Graph({
      objects: objects,
      scale: 0.4,
      position: [x, y],
      width: GRAPH_WIDTH,
      height: GRAPH_HEIGHT,
    });
    debugGraphs.push(graph);
    stage.add(graph);
  };

  const clearDebugGraphs = () => {
    debugGraphs.forEach((graph) => {
      graph.delete();
    });
    debugGraphs = [];
  };

  let currentFarthestPoints: Record<string, Point> = {};
  let currentSupportPoints: Record<string, Point> = {};
  // let currentSupportPointDirectionArrows: Record<string, Arrow> = {};
  let currentIsCollidingDebug: Record<string, any> = {};
  let inconclusiveSimplexes: Record<string, StageObject> = {};
  let inconclusiveSimplexesDirections: Record<string, Arrow> = {};
  let showInconclusiveSimplexes = false;
  let isCollidingSimplex: (StageObject & Drawable) | null = null;

  gjkCollisionDetector.addDebugObserver((data) => {
    let debugGraphObjects: (StageObject & Drawable)[] = [];

    const furthestPoint1 = data.furthestPoint1;
    if (furthestPoint1) {
      const id = furthestPoint1[0] + "-" + furthestPoint1[1];
      if (!currentFarthestPoints[id]) {
        const entity = new Point({
          radius: 5,
          position: furthestPoint1,
          color: [1, 1, 1, 1],
        });
        stage.add(entity);
        currentFarthestPoints[id] = entity;
      }
    }

    const furthestPoint2 = data.furthestPoint2;
    if (furthestPoint2) {
      const id = furthestPoint2[0] + "-" + furthestPoint2[1];
      if (!currentFarthestPoints[id]) {
        const entity = new Point({
          radius: 5,
          position: furthestPoint2,
          color: [1, 1, 1, 1],
        });
        stage.add(entity);
        currentFarthestPoints[id] = entity;
      }
    }

    if (data.isColliding) {
      if (!data.simplex || data.simplex.length === 0) {
        return;
      }

      const id = data.direction[0] + "-" + data.direction[1];
      if (!currentIsCollidingDebug[id]) {
        currentIsCollidingDebug[id] = data;
      }

      const simplex = data.simplex;
      if (simplex) {
        if (simplex.length === 2) {
          console.log("Creating isCollidingSimplex line");
          isCollidingSimplex = new Line({
            startPosition: simplex[0],
            endPosition: simplex[1],
            color: [0.8, 0.0, 0.6, 1],
          });
        } else if (simplex.length === 3) {
          isCollidingSimplex = new Triangle({
            vertices: simplex,
            color: [0.0, 0.8, 0.6, 1],
          });
        }

        if (isCollidingSimplex) {
          stage.add(isCollidingSimplex);
          debugGraphObjects.push(isCollidingSimplex);
        }
      }
    }

    if (data.inconclusiveSimplex) {
      if (!data.simplex || data.simplex.length === 0) {
        return;
      }

      const id = (data.simplex as [number, number][])
        .map((vertex) => vertex[0] + "-" + vertex[1])
        .join("-");
      if (!inconclusiveSimplexes[id]) {
        let inconclusiveSimplex: StageObject | null = null;
        if (data.simplex.length === 2) {
          inconclusiveSimplex = new Line({
            startPosition: data.simplex[0],
            endPosition: data.simplex[1],
            color: [0.0, 0.3, 0.3, 1],
          });
        } else if (data.simplex.length === 3) {
          inconclusiveSimplex = new Triangle({
            vertices: data.simplex,
            color: [0.0, 0.3, 0.3, 1],
          });
        }

        if (inconclusiveSimplex) {
          stage.add(inconclusiveSimplex);
          debugGraphObjects.push(inconclusiveSimplex);
          inconclusiveSimplexes[id] = inconclusiveSimplex;
        }
      }

      if (data.direction) {
        if (!inconclusiveSimplexesDirections[id]) {
          const MAGNITUDE = 50;
          const [A, B] = data.simplex;
          const directionStart: [number, number] = [
            (A[0] + B[0]) / 2,
            (A[1] + B[1]) / 2,
          ];
          const directionEnd: [number, number] = [
            directionStart[0] + data.direction[0] * MAGNITUDE,
            directionStart[1] + data.direction[1] * MAGNITUDE,
          ];

          inconclusiveSimplexesDirections[id] = new Arrow({
            basePosition: directionStart,
            tipPosition: directionEnd,
            tipLength: 10,
            stroke: 4,
            color: [0.8, 0.0, 0.6, 1],
          });
          stage.add(inconclusiveSimplexesDirections[id]);
          debugGraphObjects.push(inconclusiveSimplexesDirections[id]);
        }
      }
    }

    const supportPoint = data.supportPoint;
    if (supportPoint) {
      const id = supportPoint[0] + "-" + supportPoint[1];
      if (!currentSupportPoints[id]) {
        const entity = new Point({
          radius: 5,
          position: supportPoint,
          color: [0.8, 0.0, 0.6, 1],
        });
        stage.add(entity);
        debugGraphObjects.push(entity);
        currentSupportPoints[id] = entity;
      }
    }

    if (debugGraphObjects.length > 1) {
      addDebugGraph(debugGraphObjects);
    }
  });

  const debugCleanup = () => {
    if (!currentFarthestPoints.length) {
      for (const id in currentFarthestPoints) {
        currentFarthestPoints[id].delete();
      }
      currentFarthestPoints = {};
    }

    if (!currentSupportPoints.length) {
      for (const id in currentSupportPoints) {
        currentSupportPoints[id].delete();
      }
      currentSupportPoints = {};
    }

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
      currentCollisions = [];
    }

    if (!showInconclusiveSimplexes) {
      for (const id in inconclusiveSimplexes) {
        inconclusiveSimplexes[id].delete();
      }
      inconclusiveSimplexes = {};
    }

    if (!inconclusiveSimplexesDirections.length) {
      for (const id in inconclusiveSimplexesDirections) {
        inconclusiveSimplexesDirections[id].delete();
      }
      inconclusiveSimplexesDirections = {};
    }

    if (isCollidingSimplex) {
      isCollidingSimplex.delete();
      isCollidingSimplex = null;
    }

    currentIsCollidingDebug = {};

    clearDebugGraphs();
  };

  const centerPoint = new Point({
    radius: 5,
    position: [0, 0],
    color: [0, 1, 0, 1],
  });
  stage.add(centerPoint);

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    debugCleanup();

    stage.update(elapsed);

    updateFpsPerf();
    updateDebugInfo({
      // collisions: currentCollisions,
      // numObjects: stage.objects.length,
      // simplexes: constructInconclusiveSimplexes(inconclusiveSimplexes),
      // isCollidingDebug: currentIsCollidingDebug,
      isColliding:
        Object.keys(currentIsCollidingDebug).length > 0 ? true : undefined,
    });
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

const constructInconclusiveSimplexes = (
  inconclusiveSimplexes: Record<string, StageObject>
) => {
  return Object.keys(inconclusiveSimplexes).map((key, i) => {
    if (inconclusiveSimplexes[key] instanceof Line) {
      const vert = [
        inconclusiveSimplexes[key].startPosition,
        inconclusiveSimplexes[key].endPosition,
      ];
      return {
        simplex: i + 1,
        type: "line",
        vertices: vert,
      };
    } else if (inconclusiveSimplexes[key] instanceof Triangle) {
      const vert = inconclusiveSimplexes[key].vertices;
      return {
        simplex: i + 1,
        type: "triangle",
        vertices: vert,
      };
    }

    throw new Error("Inconclusive simplex is not a line or triangle");
  });
};

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

class Triangle implements Drawable {
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
