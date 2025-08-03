import { Ball } from "../engine/object/ball";
import { Rectangle } from "../engine/object/rectangle";
import { GeneralCollisionResolver } from "../engine/physics/collision/general";
import { GJKCollisionDetector } from "../engine/physics/collision/GJK";
import Physics from "../engine/physics/physics";
import Stage from "../engine/stage";

function main() {
  const { stage } = init();

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    stage.update(elapsed);
    updateFpsPerf();
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function init() {
  const gjk = new GJKCollisionDetector();
  const resolver = new GeneralCollisionResolver();
  const physics = new Physics({
    collisionDetector: gjk,
    collisionResolver: resolver,
  });

  const stage = new Stage({ width: 1000, height: 1000, physics });
  stage.panAndZoom = true;

  // Spawn area
  const spawnOriginx = 0;
  const spawnOriginy = 0;
  const spawnPadding = 50;
  const spawnw = stage.width - spawnPadding * 2;
  const spawnh = stage.height - spawnPadding * 2;

  const numSpawnEntities = 80;

  function randomCirclesSpawn() {
    const circleSharedProps = {
      radius: 15,
      type: "dynamic" as const,
    };

    // Spawn circles
    for (let i = 0; i < numSpawnEntities; i++) {
      const x = spawnOriginx + Math.random() * spawnw - spawnw / 2;
      const y = spawnOriginy + Math.random() * spawnh - spawnh / 2;
      const vx = Math.random() * 200 - 100;
      const vy = Math.random() * 200 - 100;

      const circle = new Ball({
        position: [x, y],
        velocity: [vx, vy],
        color: [0, 0, Math.random() * 0.5 + 0.5, 1],
        ...circleSharedProps,
      });
      stage.add(circle);
    }
  }

  function randomRectanglesSpawn() {
    const circleSharedProps = {
      radius: 15,
      type: "dynamic" as const,
    };

    // Spawn circles
    for (let i = 0; i < numSpawnEntities; i++) {
      const x = spawnOriginx + Math.random() * spawnw - spawnw / 2;
      const y = spawnOriginy + Math.random() * spawnh - spawnh / 2;
      const vx = Math.random() * 200 - 100;
      const vy = Math.random() * 200 - 100;

      const circle = new Ball({
        position: [x, y],
        velocity: [vx, vy],
        color: [0, 0, Math.random() * 0.5 + 0.5, 1],
        ...circleSharedProps,
      });
      stage.add(circle);
    }
  }

  function spawnWalls() {
    const ground = new Rectangle({
      position: [0, stage.height / 2 - 25],
      width: stage.width,
      height: 50,
      color: [0, 1, 0, 1],
    });
    stage.add(ground);

    const leftWall = new Rectangle({
      position: [25 - stage.width / 2, 0],
      width: 50,
      height: stage.height - 100,
      color: [0, 1, 0, 1],
    });
    stage.add(leftWall);

    const rightWall = new Rectangle({
      position: [stage.width / 2 - 25, 0],
      width: 50,
      height: stage.height - 100,
      color: [0, 1, 0, 1],
    });
    stage.add(rightWall);

    const ceiling = new Rectangle({
      position: [0, 25 - stage.height / 2],
      width: stage.width,
      height: 50,
      color: [0, 1, 0, 1],
    });
    stage.add(ceiling);
  }

  // Init
  spawnWalls();
  // randomCirclesSpawn();
  randomRectanglesSpawn();

  return {
    stage,
  };
}

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
