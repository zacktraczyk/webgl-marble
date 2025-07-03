import { Circle } from "../engine/object/circle";
import { Rectangle } from "../engine/object/rectangle";
import Stage from "../engine/stage";

function main() {
  const stage = new Stage();
  stage.panAndZoom = true;

  const spawnX = stage.canvas.clientWidth / 2 - 250;
  const spawnY = 100;

  const circle1 = new Circle({
    position: [spawnX, spawnY],
    radius: 40,
    color: [1, 0, 0, 1],
  });
  stage.add(circle1);

  const square1 = new Rectangle({
    position: [spawnX, stage.canvas.clientHeight / 2],
    width: 100,
    height: 100,
    rotation: Math.PI / 8,
    physicsType: "kinematic",
    color: [0, 1, 0, 1],
  });
  stage.add(square1);

  const collisions: [number, number][] = [];
  stage.registerPhysicsObserver(({ collisions: newCollisions }) => {
    for (const collision of newCollisions) {
      const alreadyCollided = collisions.some(
        (c) => c[0] === collision[0].id && c[1] === collision[1].id
      );
      if (alreadyCollided) {
        continue;
      }

      collisions.push([collision[0].id, collision[1].id]);
    }
  });

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    if (circle1.position[1] > stage.canvas.clientHeight + 100) {
      circle1.velocity[0] = 0;
      circle1.velocity[1] = 0;
      circle1.position[0] = spawnX;
      circle1.position[1] = spawnY;
    }

    stage.update(elapsed);
    updateFpsPerf();
    updateDebugInfo({ collisions });
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
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
