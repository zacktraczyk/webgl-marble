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
      position: [100 + i * 13, 100 + i * 13],
      radius: 20,
    });
    vdu.add(c);
    circles.push(c);
  }

  const squares: Square[] = [];
  for (let i = 0; i < 10; i++) {
    const s = new Square({
      position: [170, 110 + i * 10],
      width: 20,
    });
    vdu.add(s);
    squares.push(s);
  }

  let tick = 0;
  function updateScene(time: number) {
    tick += 0.01;
    updateFps(time);

    circles.forEach((c, i) => {
      c.color[0] = Math.sin(tick + i + Math.PI / 2) * 0.25 + 0.5;
      c.color[1] = Math.sin(tick * 3 + i + Math.PI / 3) * 0.25 + 0.5;
      c.color[2] = Math.sin(tick * 4 + i + Math.PI) * 0.25 + 0.5;

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
