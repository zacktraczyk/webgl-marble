import { Arrow } from "../engine/object/arrow";
import {
  DragAndDropCircle,
  DragAndDropHexagon,
  DragAndDropRectangle,
} from "../engine/object/dragAndDrop";
import { Line } from "../engine/object/line";
import {
  SATCollisionDetector,
  SequentialImpulseSolver,
} from "../engine/physics/collision";
import Physics from "../engine/physics/physics";
import type { Scene } from "../engine/runtime/scene";
import Stage from "../engine/stage";

function createScene(): Scene {
  const physics = new Physics({
    collisionDetector: new SATCollisionDetector(),
    collisionResolver: new SequentialImpulseSolver(),
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
    manifold: {
      normal: [number, number];
      penetrationDepth: number;
    };
  }[] = [];

  let collisionEdges: Record<string, Line> = {};
  let contactNormalArrows: Record<string, [Arrow, Arrow]> = {};
  stage.registerPhysicsObserver(async ({ collisions }) => {
    for (const collision of collisions) {
      const {
        entity1,
        entity2,
        diagnostics,
        manifold: { normal, penetrationDepth: magnitude },
      } = collision;
      const edge = diagnostics?.referenceEdge;
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
        if (!contactNormalArrows[collisionKey]) {
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
          contactNormalArrows[collisionKey] = [arrow, arrow2];
        }

        // const mtvBasePosition = entity2.position;

        // const mtvTipPosition = [
        //   mtvBasePosition[0] + normal[0] * magnitude,
        //   mtvBasePosition[1] + normal[1] * magnitude,
        // ];

        contactNormalArrows[collisionKey][0].basePosition = [
          entity2.position[0],
          entity2.position[1],
        ];
        contactNormalArrows[collisionKey][0].tipPosition = [
          entity2.position[0] + normal[0] * magnitude,
          entity2.position[1] + normal[1] * magnitude,
        ];

        contactNormalArrows[collisionKey][1].basePosition = [
          entity1.position[0],
          entity1.position[1],
        ];
        contactNormalArrows[collisionKey][1].tipPosition = [
          entity1.position[0] - normal[0] * magnitude,
          entity1.position[1] - normal[1] * magnitude,
        ];
      }
    }

    currentCollisions = collisions.map((collision) => {
      const collisionDebug = {
        entity1: collision.entity1.parent.id,
        entity2: collision.entity2.parent.id,
        referenceEdge: collision.diagnostics?.referenceEdge,
        manifold: collision.manifold,
      };

      return collisionDebug;
    });
  });

  return {
    fixedUpdate: (deltaMs) => {
      stage.update(deltaMs);
      if (!currentCollisions.length) {
        for (const collisionKey in collisionEdges) {
          collisionEdges[collisionKey].delete();
        }
        for (const collisionKey in contactNormalArrows) {
          contactNormalArrows[collisionKey][0].delete();
          contactNormalArrows[collisionKey][1].delete();
        }
        collisionEdges = {};
        contactNormalArrows = {};
      }
    },
    update: () => {
      updateDebugInfo({ collisions: currentCollisions });
      currentCollisions = [];
    },
    render: () => stage.render(),
    dispose: () => stage.dispose(),
  };
}

// Debug info
const debugInfoElem = document.getElementById("#debug-info");
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const updateDebugInfo = (obj: any) => {
  if (debugInfoElem) {
    debugInfoElem.textContent = JSON.stringify(obj, null, 2);
  }
};

export default createScene;
