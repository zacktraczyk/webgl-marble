import "./style.css";
import { Circle } from "./utils/circle";
import { Rectangle } from "./utils/rectangle";
import { throttle } from "./utils/utils";
import { VDU } from "./utils/vdu";

function main() {
  const vdu = new VDU("#gl-canvas");

  const marble = new Circle({
    position: [vdu.canvas.clientWidth / 2, 200],
    radius: 20,
    color: [1, 0, 0, 1],
  });
  vdu.add(marble);

  const ground = new Rectangle({
    position: [vdu.canvas.clientWidth / 2, vdu.canvas.clientHeight - 25],
    width: vdu.canvas.clientWidth,
    height: 50,
    color: [0, 1, 0, 1],
  });
  vdu.add(ground);

  const acc = 0.03;
  const dampen = 0.6;
  let velocity = 0;

  let tick = 0;
  function updateScene(time: number) {
    tick += 0.01;

    velocity += acc;
    if (
      marble.position[1] + marble.radius >=
      ground.position[1] - ground.height / 2
    ) {
      velocity = -velocity * dampen;
    }
    marble.position[1] += velocity;

    updateFps(time);
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
