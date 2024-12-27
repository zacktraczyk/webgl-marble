import { VDU } from "./engine/vdu/vdu";
import "./style.css";

const vdu = new VDU("#gl-canvas");

export default function drawScene() {
  // linesSpawn();

  let tick = 0;
  function updateScene() {
    tick += 1;

    updateFpsPerf();
  }

  function render() {
    updateScene();

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

// linesSpawn = () => {
//   const line = new
// }

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
