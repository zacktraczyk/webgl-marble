import Stage from "../engine/stage";
import { Rectangle } from "../engine/object/rectangle";
import { Circle } from "../engine/object/circle";
import type { Ball } from "../engine/object/ball";

const NUM_SPAWN_ENTITIES = 40;
const SPAWN_BUFFER = 10;
const BALL_RADIUS = 40;

type Color = [number, number, number, number];

const BALL_COLOR: Color = [239 / 255, 68 / 255, 68 / 255, 1];

const WALL_COLOR: Color = [34 / 255, 197 / 255, 94 / 255, 1];
const SQUARE_COLOR: Color = [56 / 255, 189 / 255, 248 / 255, 1];

const getSafeSpawnBallPosition = ({
  balls,
  xRange: [xMin, xMax],
  yRange: [yMin, yMax],
}: {
  balls: (Circle | Ball)[];
  xRange: [number, number];
  yRange: [number, number];
}) => {
  let successiveFailures = 0;
  while (true) {
    if (successiveFailures > 100) {
      throw new Error(
        "Failed to spawn balls, unable to find suitable spawn positions"
      );
    }

    const y = Math.random() * (yMax - yMin) + yMin;
    const x = Math.random() * (xMax - xMin) + xMin;

    for (const ball of balls) {
      if (
        Math.abs(ball.position[0] - x) < ball.radius + SPAWN_BUFFER &&
        Math.abs(ball.position[1] - y) < ball.radius + SPAWN_BUFFER
      ) {
        successiveFailures++;
        continue;
      }
    }

    return [x, y];
  }
};

const getOscillationMagnitude = (desiredWidth: number, period: number) => {
  // TODO: Correct translation from position to velocity magnitude
  const velocityMagnitude = desiredWidth / 4;
  return velocityMagnitude;
};

function main() {
  const stage = new Stage();
  stage.panAndZoom = true;

  const balls: Circle[] = [];
  for (let i = 0; i < NUM_SPAWN_ENTITIES; i++) {
    const width = stage.canvas.clientWidth / 2;
    const [x, y] = getSafeSpawnBallPosition({
      balls,
      xRange: [-width, width],
      yRange: [
        -stage.canvas.clientHeight / 2 - 200,
        -stage.canvas.clientHeight / 2 - 100,
      ],
    });

    const ball = new Circle({
      position: [x, y],
      radius: BALL_RADIUS,
      color: BALL_COLOR,
    });
    balls.push(ball);
    stage.add(ball);
  }

  const thirdHeight = stage.canvas.clientHeight / 3;

  const square1 = new Rectangle({
    position: [0, -thirdHeight],
    width: 100,
    height: 300,
    rotation: 0,
    physicsType: "kinematic",
    color: SQUARE_COLOR,
  });
  stage.add(square1);

  const square2 = new Rectangle({
    position: [0, thirdHeight],
    width: 100,
    height: 300,
    rotation: Math.PI / 8,
    physicsType: "kinematic",
    color: SQUARE_COLOR,
  });
  stage.add(square2);

  const spinnerArm1 = new Rectangle({
    position: [0, 0],
    width: 300,
    height: 10,
    color: SQUARE_COLOR,
  });
  stage.add(spinnerArm1);

  const spinnerArm2 = new Rectangle({
    position: [0, 0],
    width: 300,
    height: 10,
    rotation: Math.PI / 2,
    color: SQUARE_COLOR,
  });
  stage.add(spinnerArm2);

  const leftWall = new Rectangle({
    position: [-stage.canvas.clientWidth / 2, 0],
    width: 50,
    height: stage.canvas.clientHeight,
    color: WALL_COLOR,
  });
  stage.add(leftWall);

  const rightWall = new Rectangle({
    position: [stage.canvas.clientWidth / 2, 0],
    width: 50,
    height: stage.canvas.clientHeight,
    color: WALL_COLOR,
  });
  stage.add(rightWall);

  const resetOutOfBoundsCircles = () => {
    for (const ball of balls) {
      if (ball.position[1] > stage.canvas.clientHeight + 100) {
        ball.velocity[0] = 0;
        ball.velocity[1] = 0;

        const [x, y] = getSafeSpawnBallPosition({
          balls,
          xRange: [-stage.canvas.clientWidth / 2, stage.canvas.clientWidth / 2],
          yRange: [
            -stage.canvas.clientHeight / 2 - 200,
            -stage.canvas.clientHeight / 2 - 100,
          ],
        });
        ball.position = [x, y];
      }
    }
  };

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    // Oscillate squares
    const oscillationWidth = stage.canvas.clientWidth / 2;
    const oscillationMagnitude = getOscillationMagnitude(
      oscillationWidth,
      1000
    );
    square1.velocity[0] =
      (Math.sin(time / 1000 + Math.PI / 2) * oscillationMagnitude) / 2;
    square2.velocity[0] = (Math.sin(time / 1000) * oscillationMagnitude) / 2;

    // Rotate spinner arms
    // TODO: Angular velocity
    spinnerArm1.rotation += 0.01;
    spinnerArm2.rotation += 0.01;

    stage.update(elapsed);
    resetOutOfBoundsCircles();
    updateFpsPerf();
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
