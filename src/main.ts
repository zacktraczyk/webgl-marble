import "./style.css";
import Physics from "./utils/physics";
import { Rectangle } from "./utils/rectangle";
import { VDU } from "./utils/vdu";

function main() {
  const vdu = new VDU("#gl-canvas");
  const physics = new Physics();

  const box = new Rectangle({
    position: [vdu.canvas.clientWidth / 2, 200],
    width: 20,
    height: 20,
    color: [1, 0, 0, 1],
    type: "dynamic",
  });
  vdu.add(box);
  physics.add(box);

  const ground = new Rectangle({
    position: [vdu.canvas.clientWidth / 2, vdu.canvas.clientHeight - 25],
    width: vdu.canvas.clientWidth,
    height: 50,
    color: [0, 1, 0, 1],
  });
  vdu.add(ground);
  physics.add(ground);

  // let tick = 0;

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
