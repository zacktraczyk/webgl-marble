import {
  SATNarrowPhase,
  SequentialImpulseSolver,
  type Collision,
} from "../engine/physics/collision";
import Physics from "../engine/physics/physics";
import type { Scene } from "../engine/runtime/scene";
import Stage from "../engine/stage";
import {
  collisionDebugData,
  deleteEntities,
  spawnCollisionDemoShapes,
  spawnCollisionDiagnostics,
} from "./collisionDemoSupport";

function createScene(): Scene {
  const stage = new Stage({
    physics: new Physics({
      narrowPhase: new SATNarrowPhase(),
      contactSolver: new SequentialImpulseSolver(),
    }),
  });
  stage.dragAndDrop = true;
  stage.panAndZoom = true;
  stage.drawMode = "TRIANGLES";
  spawnCollisionDemoShapes(stage);

  let collisions: Collision[] = [];
  let diagnostics = spawnCollisionDiagnostics(stage, collisions);
  stage.registerPhysicsObserver((event) => {
    collisions = event.collisions;
  });

  return {
    fixedUpdate: (deltaMs) => {
      deleteEntities(diagnostics);
      collisions = [];
      stage.update(deltaMs);
      diagnostics = spawnCollisionDiagnostics(stage, collisions);
    },
    update: () =>
      updateDebugInfo({ collisions: collisionDebugData(collisions) }),
    render: () => stage.render(),
    dispose: () => stage.dispose(),
  };
}

const debugInfoElem = document.getElementById("debug-info");
const updateDebugInfo = (value: unknown) => {
  if (debugInfoElem) {
    debugInfoElem.textContent = JSON.stringify(value, null, 2);
  }
};

export default createScene;
