import { Circle } from "./engine/object/circle";
import { Rectangle } from "./engine/object/rectangle";
import Physics from "./engine/physics/physics";
import { VDU } from "./engine/vdu/vdu";
import "./style.css";

function main() {
  const vdu = new VDU("#gl-canvas");
  const physics = new Physics();

  // Spawn area
  const spawnOriginx = vdu.canvas.clientWidth / 2;
  const spawnOriginy = vdu.canvas.clientHeight / 2;
  const spawnPadding = 50;
  const spawnw = vdu.canvas.clientWidth - spawnPadding * 2;
  const spawnh = vdu.canvas.clientHeight - spawnPadding * 2;

  const numSpawnEntities = 50;

  function randomBoxesSpawn() {
    const boxSharedProps = {
      width: 20,
      height: 20,
      type: "dynamic" as const,
    };

    // Spawn boxes
    for (let i = 0; i < numSpawnEntities; i++) {
      const x = spawnOriginx + Math.random() * spawnw - spawnw / 2;
      const y = spawnOriginy + Math.random() * spawnh - spawnh / 2;
      const vx = Math.random() * 200 - 100;
      const vy = Math.random() * 200 - 100;

      const box = new Rectangle({
        position: [x, y],
        velocity: [vx, vy],
        color: [Math.random() * 0.5 + 0.5, 0, 0, 1],
        ...boxSharedProps,
      });
      vdu.add(box);
      physics.add(box);
    }
  }

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

      const circle = new Circle({
        position: [x, y],
        velocity: [vx, vy],
        color: [0, 0, Math.random() * 0.5 + 0.5, 1],
        ...circleSharedProps,
      });
      vdu.add(circle);
      physics.add(circle);
    }
  }

  function spawnWalls() {
    const ground = new Rectangle({
      position: [vdu.canvas.clientWidth / 2, vdu.canvas.clientHeight - 25],
      width: vdu.canvas.clientWidth,
      height: 50,
      color: [0, 1, 0, 1],
    });
    vdu.add(ground);
    physics.add(ground);

    const leftWall = new Rectangle({
      position: [25, vdu.canvas.clientHeight / 2],
      width: 50,
      height: vdu.canvas.clientHeight - 100,
      color: [0, 1, 0, 1],
    });
    vdu.add(leftWall);
    physics.add(leftWall);

    const rightWall = new Rectangle({
      position: [vdu.canvas.clientWidth - 25, vdu.canvas.clientHeight / 2],
      width: 50,
      height: vdu.canvas.clientHeight - 100,
      color: [0, 1, 0, 1],
    });
    vdu.add(rightWall);
    physics.add(rightWall);

    const ceiling = new Rectangle({
      position: [vdu.canvas.clientWidth / 2, 25],
      width: vdu.canvas.clientWidth,
      height: 50,
      color: [0, 1, 0, 1],
    });
    vdu.add(ceiling);
    physics.add(ceiling);
  }

  const spinningSquare = new Rectangle({
    position: [vdu.canvas.clientWidth / 2, vdu.canvas.clientHeight / 2],
    width: 50,
    height: 50,
    color: [1, 1, 1, 1],
    type: "kinematic",
  });
  vdu.add(spinningSquare);

  // Init
  spawnWalls();
  randomCirclesSpawn();
  // randomBoxesSpawn();

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    spinningSquare.rotation += 1;

    if (spinningSquare.rotation > 360) {
      spinningSquare.rotation = 0;
    }

    physics.update(elapsed);
    updateFpsPerf();
  }

  function render() {
    updateScene();

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
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

main();
