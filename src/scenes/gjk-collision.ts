import { Arrow } from "../engine/object/arrow";
import { Graph } from "../engine/object/graph";
import { Line } from "../engine/object/line";
import { Point } from "../engine/object/point";
import { Triangle } from "../engine/object/triangle";
import { GJKCollisionDetector } from "../engine/physics/collision/GJK";
import { SATCollisionResolver } from "../engine/physics/collision/SAT";
import Physics from "../engine/physics/physics";
import Stage, { type StageObject } from "../engine/stage";
import { type Drawable } from "../engine/vdu/entity";
import {
  DragAndDropCircle,
  DragAndDropHexagon,
  DragAndDropRectangle,
} from "../engine/object/dragAndDrop";

function main() {
  const { stage, debugCleanup } = init();

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

  // Origin
  const centerPoint = new Point({
    radius: 5,
    position: [0, 0],
    color: [0, 1, 0, 1],
  });
  stage.add(centerPoint);

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

  const cleanupCollision = () => {
    if (currentCollisions.length > 0) {
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
  };

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    debugCleanup();
    cleanupCollision();

    stage.update(elapsed);

    updateFpsPerf();
    updateDebugInfo({
      collisions: currentCollisions,
    });
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function init() {
  // Stage
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

  // Grid
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

  // Debug Graphs
  let debugGraphs: Graph[] = [];
  const addDebugGraph = (objects: (StageObject & Drawable)[]) => {
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

  // Debug data
  let currentFarthestPoints: Record<string, Point> = {};
  let currentSupportPoints: Record<string, Point> = {};
  let currentIsCollidingDebug: Record<string, any> = {};
  let inconclusiveSimplexes: Record<string, StageObject> = {};
  let inconclusiveSimplexesDirections: Record<string, Arrow> = {};
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

    if (Object.keys(inconclusiveSimplexes).length > 0) {
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

  return { stage, debugCleanup };
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
