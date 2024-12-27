import Line from "./engine/object/line";
import { Rectangle } from "./engine/object/rectangle";
import { VDU } from "./engine/vdu/vdu";
import "./style.css";

const vdu = new VDU("#gl-canvas");

export default function drawLines() {
  squareTrace();
  spinnyLineSpawn();

  let tick = 0;
  function updateScene() {
    tick += 1;
    updateSpinnyLine(tick);

    updateFpsPerf();
  }

  function render() {
    updateScene();

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

const w = 300;
const h = 100;
const stroke = 4;
const squareTrace = () => {
  const vw = vdu.canvas.clientWidth;
  const vh = vdu.canvas.clientHeight;

  const square = new Rectangle({
    width: w,
    height: h,
    position: [vw / 2, vh / 2],
    color: [0, 1, 0, 1],
  });
  vdu.add(square);

  // X
  const lineCriss = new Line({
    begin: [vw / 2 - w / 2, vh / 2 - h / 2],
    end: [vw / 2 + w / 2, vh / 2 + h / 2],
    stroke,
    color: [1, 0, 0, 1],
  });
  vdu.add(lineCriss);

  const lineCross = new Line({
    begin: [vw / 2 + w / 2, vh / 2 - h / 2],
    end: [vw / 2 - w / 2, vh / 2 + h / 2],
    stroke,
    color: [1, 0, 0, 1],
  });
  vdu.add(lineCross);

  // Border
  const lineTop = new Line({
    begin: [vw / 2 - w / 2 - stroke / 2, vh / 2 - h / 2],
    end: [vw / 2 + w / 2 + stroke / 2, vh / 2 - h / 2],
    stroke,
    color: [1, 0, 0, 1],
  });
  vdu.add(lineTop);

  const lineRight = new Line({
    begin: [vw / 2 + w / 2, vh / 2 - h / 2 - stroke / 2],
    end: [vw / 2 + w / 2, vh / 2 + h / 2 + stroke / 2],
    stroke,
    color: [1, 0, 0, 1],
  });
  vdu.add(lineRight);

  const lineBottom = new Line({
    begin: [vw / 2 - w / 2 - stroke / 2, vh / 2 + h / 2],
    end: [vw / 2 + w / 2 + stroke / 2, vh / 2 + h / 2],
    stroke,
    color: [1, 0, 0, 1],
  });
  vdu.add(lineBottom);

  const lineLeft = new Line({
    begin: [vw / 2 - w / 2, vh / 2 - h / 2 - stroke / 2],
    end: [vw / 2 - w / 2, vh / 2 + h / 2 + stroke / 2],
    stroke,
    color: [1, 0, 0, 1],
  });
  vdu.add(lineLeft);
};

const spinnyLine = new Line({
  begin: [vdu.canvas.clientWidth / 2, vdu.canvas.clientHeight / 2],
  end: [0, 0],
  stroke: 4,
  color: [0, 0, 1, 1],
});

const spinnyLineSpawn = () => {
  vdu.add(spinnyLine);
};

const updateSpinnyLine = (tick: number) => {
  const vw = vdu.canvas.clientWidth;
  const vh = vdu.canvas.clientHeight;

  const x = vw / 2 + Math.cos(tick / 100) * 300;
  const y = vh / 2 + Math.sin(tick / 100) * 300;

  spinnyLine.end = [x, y];
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
