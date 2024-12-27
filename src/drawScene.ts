import { Circle } from "./engine/object/circle";
import { Rectangle } from "./engine/object/rectangle";
import { VDU } from "./engine/vdu/vdu";
import "./style.css";

const vdu = new VDU("#gl-canvas");

export default function drawScene() {
  cornerCirclesSpawn();
  pinwheelSpawn();
  squareCenterSpawn();

  let tick = 0;
  function updateScene() {
    tick += 1;
    pinwheelRotate(tick);

    updateFpsPerf();
  }

  function render() {
    updateScene();

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

const squareCenterSpawn = () => {
  const square = new Rectangle({
    position: [vdu.canvas.clientWidth / 2, vdu.canvas.clientHeight / 2],
    width: 50,
    height: 50,
    color: [1, 0, 0, 1],
  });
  vdu.add(square);
};

const cornerCirclesSpawn = () => {
  const circleSharedProps = {
    radius: 15,
  };
  const padding = 50;
  const placement = [padding, vdu.canvas.clientWidth - padding];

  for (const x of placement) {
    for (const y of placement) {
      const circle = new Circle({
        position: [x, y],
        color: [0, 0, 1, 1],
        ...circleSharedProps,
      });
      vdu.add(circle);
    }
  }
};

let spinningSquare1: Rectangle;
let spinningSquare2: Rectangle;
const pinwheelSpawn = () => {
  spinningSquare1 = new Rectangle({
    position: [vdu.canvas.clientWidth / 2, vdu.canvas.clientHeight / 2],
    width: 50,
    height: 5,
    color: [0, 1, 0, 1],
  });
  vdu.add(spinningSquare1);

  spinningSquare2 = new Rectangle({
    position: [vdu.canvas.clientWidth / 2, vdu.canvas.clientHeight / 2],
    width: 50,
    height: 5,
    color: [0, 1, 0, 1],
    rotation: Math.PI / 2,
  });
  vdu.add(spinningSquare2);
};

const pinwheelRotate = (tick: number) => {
  if (!spinningSquare1 || !spinningSquare2) {
    return;
  }

  spinningSquare1.position = [
    vdu.canvas.clientWidth / 2 + Math.sin(tick / 100) * 200,
    vdu.canvas.clientHeight / 2 + Math.cos(tick / 100) * 200,
  ];
  spinningSquare2.position = [
    vdu.canvas.clientWidth / 2 + Math.sin(tick / 100) * 200,
    vdu.canvas.clientHeight / 2 + Math.cos(tick / 100) * 200,
  ];

  spinningSquare1.rotation += 0.05;
  spinningSquare2.rotation += 0.05;
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
