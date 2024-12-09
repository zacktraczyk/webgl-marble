import "./style.css";
import { Circle } from "./utils/circle";
import { Square } from "./utils/square";
import { throttle } from "./utils/utils";
import { VDU } from "./utils/vdu";

function main() {
  const vdu = new VDU("#gl-canvas");

  const circles: Circle[] = [];
  for (let i = 0; i < 10; i++) {
    const c = new Circle({
      position: [240 + i * 13, 240 + i * 13],
      radius: 20,
      color: [Math.random(), Math.random(), Math.random(), 1],
    });
    vdu.add(c);
    circles.push(c);
  }

  const squares: Square[] = [];
  for (let i = 0; i < 10; i++) {
    const s = new Square({
      position: [320, 270 + i * 10],
      width: 20,
      color: [Math.random() * 0.5 + 0.5, 0, 0, 1],
    });
    vdu.add(s);
    squares.push(s);
  }

  let tick = 0;
  function updateScene(time: number) {
    tick += 0.01;
    updateFps(time);

    circles.forEach((c, i) => {
      c.position[0] += Math.sin(tick + i);
      c.position[1] += Math.cos(tick + i);
    });

    squares.forEach((s, i) => {
      s.position[0] += Math.cos(tick + i);
    });
  }

  function render(time: number) {
    updateScene(time);

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

// FPS Counter
let lastTime = 0;
const fpsElem = document.getElementById("#fps");
const [updateFpsText] = throttle((fps: number) => {
  if (fpsElem) {
    fpsElem.textContent = `FPS: ${fps.toFixed(2)}`;
  }
}, 500);

const updateFps = (time: number) => {
  time *= 0.005;
  const deltaTime = time - lastTime;
  lastTime = time;
  const fps = 1 / deltaTime;
  updateFpsText(fps);
};

main();
