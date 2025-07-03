import { Circle } from "../src/engine/object/circle";
import { Rectangle } from "../src/engine/object/rectangle";
import { BoundingCircle } from "../src/engine/physics/boundingShape";
import Stage from "../src/engine/stage";

function main() {
  const { stage, finishLine } = init();

  const finishedBalls: number[] = [];
  stage.registerPhysicsObserver(({ collisions }) => {
    for (const [a, b] of collisions) {
      // TODO: Simplify
      if (
        (a.type === "dynamic" &&
          a.boundingShape instanceof BoundingCircle &&
          b.parent === finishLine) ||
        (b.type === "dynamic" &&
          b.boundingShape instanceof BoundingCircle &&
          a.parent === finishLine)
      ) {
        if (!a.markedForDeletion && a.parent && a.parent !== finishLine) {
          a.parent.delete();
          finishedBalls.push(a.id);
        }
        if (!b.markedForDeletion && b.parent && b.parent !== finishLine) {
          b.parent.delete();
          finishedBalls.push(b.id);
        }
      }
    }
  });

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    stage.update(elapsed);
    updateFpsPerf();
    updateDebugInfo({ finishedBalls });
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function init() {
  const stage = new Stage({
    height: 1000,
    width: 1000,
  });
  stage.panAndZoom = true;

  // Spawn area
  const spawnOriginx = stage.width / 2;
  const spawnOriginy = 110;
  const spawnPadding = 50;
  const spawnw = stage.width - spawnPadding * 2;
  const spawnh = 180 - spawnPadding * 2;

  const numSpawnEntities = 200;

  function randomCirclesSpawn() {
    const circleSharedProps = {
      radius: 12,
      type: "dynamic" as const,
    };

    // Spawn circles
    const spawnPositions: [number, number][] = [];
    const spawnBuffer = 5;
    function spawnCircle(): boolean {
      const x = spawnOriginx + Math.random() * spawnw - spawnw / 2;
      const y = spawnOriginy + Math.random() * spawnh - spawnh / 2;
      const { radius } = circleSharedProps;

      for (const pos of spawnPositions) {
        if (
          Math.abs(pos[0] - x) < radius + spawnBuffer &&
          Math.abs(pos[1] - y) < radius + spawnBuffer
        ) {
          return false;
        }
      }

      spawnPositions.push([x, y]);
      i++;

      const vx = Math.random() * 200 - 100;
      const vy = 0;

      const circle = new Circle({
        position: [x, y],
        velocity: [vx, vy],
        color: [0, 0, Math.random() * 0.5 + 0.5, 1],
        ...circleSharedProps,
      });
      stage.add(circle);

      return true;
    }

    let i = 0;
    let successiveFailures = 0;
    while (i < numSpawnEntities) {
      if (spawnCircle()) {
        i++;
        successiveFailures = 0;
      } else {
        successiveFailures++;
      }

      if (successiveFailures > 100) {
        throw new Error(
          "Failed to spawn circles, unable to find suitable spawn positions"
        );
      }
    }
  }

  function spawnWalls() {
    // const ground = new Rectangle({
    //   position: [stage.width / 2, stage.height - 25],
    //   width: stage.width,
    //   height: 50,
    //   color: [0, 1, 0, 1],
    // });
    // vdu.add(ground);
    // physics.add(ground);

    const leftWall = new Rectangle({
      position: [25, stage.height / 2 + 25],
      width: 50,
      height: stage.height - 50,
      color: [0, 1, 0, 1],
    });
    stage.add(leftWall);

    const rightWall = new Rectangle({
      position: [stage.width - 25, stage.height / 2 + 25],
      width: 50,
      height: stage.height - 50,
      color: [0, 1, 0, 1],
    });
    stage.add(rightWall);

    const ceiling = new Rectangle({
      position: [stage.width / 2, 25],
      width: stage.width,
      height: 50,
      color: [0, 1, 0, 1],
    });
    stage.add(ceiling);
  }

  function spawnObstacles() {
    const numObstacles = 10;

    for (let j = 0; j < numObstacles / 2; j++) {
      for (let i = 0; i < numObstacles / 2; i++) {
        const x =
          ((stage.width - 100) / (numObstacles / 2)) *
          (i + (j % 2) * 0.5 + 0.5);
        const y = 100 + ((stage.height - 200) / (numObstacles / 2)) * (j + 0.5);

        const obstacleSquare = new Rectangle({
          position: [x, y],
          width: 50,
          height: 50,
          color: [1, 1, 1, 1],
          physicsType: "kinematic",
        });
        stage.add(obstacleSquare);
      }
    }
  }

  const finishLine = new Rectangle({
    position: [stage.width / 2, stage.height - 25],
    width: stage.width - 100,
    height: 50,
    color: [1, 0, 0, 1],
  });
  stage.add(finishLine);

  // Init
  spawnWalls();
  randomCirclesSpawn();
  spawnObstacles();

  return {
    stage,
    finishLine,
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
