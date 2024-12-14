import { Rectangle } from "./engine/object/rectangle";
import Physics from "./engine/physics/physics";
import { VDU } from "./engine/vdu/vdu";
import "./style.css";

function main() {
  const vdu = new VDU("#gl-canvas");
  const physics = new Physics();

  // Walls
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

  const boxSharedProps = {
    width: 20,
    height: 20,
    type: "dynamic" as const,
  };

  const spawnBoundary = new Rectangle({
    position: [vdu.canvas.clientWidth / 2, vdu.canvas.clientHeight / 2],
    width: vdu.canvas.clientWidth - 100,
    height: vdu.canvas.clientHeight - 100,
  });

  // Spawn boxes
  for (let i = 0; i < 50; i++) {
    const x =
      Math.random() * spawnBoundary.width - 100 + spawnBoundary.position[0] / 2;
    const y =
      Math.random() * spawnBoundary.height -
      100 +
      spawnBoundary.position[1] / 2;

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

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

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
