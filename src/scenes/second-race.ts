import { Circle } from "../engine/object/circle";
import { Rectangle } from "../engine/object/rectangle";
import { RightTriangle } from "../engine/object/triangle";
import Stage from "../engine/stage";

type Color = [number, number, number, number];

const WINDOW_PADDING = 50;

const MARBEL_COLOR: Color = [56 / 255, 189 / 255, 248 / 255, 1];
const MARBEL_RADIUS = 15;

const WALL_THICKNESS = 50;
const TRIANGLE_THICKNESS = WALL_THICKNESS * 2;
const WALL_COLOR: Color = [113 / 255, 113 / 255, 122 / 255, 1];

const NUM_PUSHERS = 6;
const PUSHER_SIZE = TRIANGLE_THICKNESS;
const PUSHER_OVERFLOW_DISTANCE = WALL_THICKNESS + PUSHER_SIZE / 2;
const PUSHER_COLOR: Color = [1, 1, 1, 1];

const OUT_OF_BOUNDS_THICKNESS = WINDOW_PADDING + PUSHER_OVERFLOW_DISTANCE;
const OUT_OF_BOUNDS_COLOR: Color = [24 / 255, 24 / 255, 27 / 255, 1];

const FINISH_LINE_THICKNESS = 25;
const FINISH_LINE_COLOR: Color = [239 / 255, 68 / 255, 68 / 255, 1];

function main() {
  const { stage, finishLine, constrainPushers } = init();

  const finishedBalls: number[] = [];
  stage.registerPhysicsObserver(({ collisions }) => {
    for (const collision of collisions) {
      const { entity1, entity2 } = collision;
      const collisionPemutations = [
        [entity1, entity2],
        [entity2, entity1],
      ];

      for (const [a, b] of collisionPemutations) {
        if (
          a.type === "dynamic" &&
          a.boundingShape?.type === "BoundingCircle" &&
          b.parent === finishLine
        ) {
          if (!a.markedForDeletion && a.parent && a.parent !== finishLine) {
            a.parent.delete();
            finishedBalls.push(a.id);
          }
        }
      }
    }
  });

  const numMarbles = 500;
  const marbels: Circle[] = [];
  const spawnBuffer = 5;
  const spawnBall = () => {
    const x = -stage.width / 2 + MARBEL_RADIUS + WALL_THICKNESS + spawnBuffer;
    const y = -stage.height / 2 + MARBEL_RADIUS + WALL_THICKNESS + spawnBuffer;

    for (const marble of marbels) {
      if (
        Math.abs(marble.position[0] - x) < MARBEL_RADIUS &&
        Math.abs(marble.position[1] - y) < MARBEL_RADIUS
      ) {
        return false;
      }
    }

    const vx = Math.random() * 70;
    const vy = Math.random() * -50 - 60;

    const newMarble = new Circle({
      position: [x, y],
      velocity: [vx, vy],
      radius: MARBEL_RADIUS,
      color: MARBEL_COLOR,
    });
    marbels.push(newMarble);
    stage.add(newMarble);
  };

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    if (marbels.length < numMarbles) {
      spawnBall();
    }

    constrainPushers();

    stage.update(elapsed);
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function init() {
  const stage = new Stage({
    height: 1200,
    width: 2000,
  });
  stage.panAndZoom = true;
  stage.centerCameraOnResize = true;
  stage.fitStageToWindowOnResizePadding = WINDOW_PADDING;
  stage.fitStageToWindowOnResize = true;

  const gapWidth = stage.width / 6;
  const thirdHeight = stage.height / 6;

  function spawnWalls() {
    const leftWall = new Rectangle({
      position: [WALL_THICKNESS / 2 - stage.width / 2, WALL_THICKNESS / 2],
      width: WALL_THICKNESS,
      height: stage.height - WALL_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(leftWall);

    const rightWall = new Rectangle({
      position: [stage.width / 2 - WALL_THICKNESS / 2, WALL_THICKNESS / 2],
      width: WALL_THICKNESS,
      height: stage.height - WALL_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(rightWall);

    const ceiling = new Rectangle({
      position: [0, WALL_THICKNESS / 2 - stage.height / 2],
      width: stage.width,
      height: WALL_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(ceiling);

    const secondFloor = new Rectangle({
      position: [-gapWidth / 2, -thirdHeight],
      width: stage.width - gapWidth,
      height: WALL_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(secondFloor);

    const t1 = new RightTriangle({
      position: [
        -stage.width / 2 + WALL_THICKNESS + TRIANGLE_THICKNESS / 2,
        -thirdHeight - WALL_THICKNESS / 2 - TRIANGLE_THICKNESS / 2,
      ],
      width: TRIANGLE_THICKNESS,
      height: TRIANGLE_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(t1);

    const firstFloor = new Rectangle({
      position: [gapWidth / 2, thirdHeight],
      width: stage.width - gapWidth,
      height: WALL_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(firstFloor);

    const t2 = new RightTriangle({
      rotation: -Math.PI / 2,
      position: [
        stage.width / 2 - WALL_THICKNESS - TRIANGLE_THICKNESS / 2,
        thirdHeight - WALL_THICKNESS / 2 - TRIANGLE_THICKNESS / 2,
      ],
      width: TRIANGLE_THICKNESS,
      height: TRIANGLE_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(t2);

    const bottomFloor = new Rectangle({
      position: [-gapWidth / 2, stage.height - 25 - stage.height / 2],
      width: stage.width - gapWidth,
      height: WALL_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(bottomFloor);

    const t3 = new RightTriangle({
      position: [
        -stage.width / 2 + WALL_THICKNESS + TRIANGLE_THICKNESS / 2,
        stage.height / 2 - WALL_THICKNESS - TRIANGLE_THICKNESS / 2,
      ],
      width: TRIANGLE_THICKNESS,
      height: TRIANGLE_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(t3);

    const outOfBoundsLeft = new Rectangle({
      position: [-stage.width / 2 - OUT_OF_BOUNDS_THICKNESS / 2, 0],
      width: OUT_OF_BOUNDS_THICKNESS,
      height: stage.height + OUT_OF_BOUNDS_THICKNESS * 2,
      color: OUT_OF_BOUNDS_COLOR,
    });
    stage.add(outOfBoundsLeft);

    const outOfBoundsRight = new Rectangle({
      position: [stage.width / 2 + OUT_OF_BOUNDS_THICKNESS / 2, 0],
      width: OUT_OF_BOUNDS_THICKNESS,
      height: stage.height + OUT_OF_BOUNDS_THICKNESS * 2,
      color: OUT_OF_BOUNDS_COLOR,
    });
    stage.add(outOfBoundsRight);

    const outOfBoundsTop = new Rectangle({
      position: [0, -stage.height / 2 - OUT_OF_BOUNDS_THICKNESS / 2],
      width: stage.width,
      height: OUT_OF_BOUNDS_THICKNESS,
      color: OUT_OF_BOUNDS_COLOR,
    });
    stage.add(outOfBoundsTop);

    const outOfBoundsBottom = new Rectangle({
      position: [0, stage.height / 2 + OUT_OF_BOUNDS_THICKNESS / 2],
      width: stage.width,
      height: OUT_OF_BOUNDS_THICKNESS,
      color: OUT_OF_BOUNDS_COLOR,
    });
    stage.add(outOfBoundsBottom);
  }

  const finishLine = new Rectangle({
    position: [
      stage.width / 2 - (gapWidth - WALL_THICKNESS) / 2 - WALL_THICKNESS,
      stage.height - stage.height / 2 - FINISH_LINE_THICKNESS / 2,
    ],
    width: gapWidth - WALL_THICKNESS,
    height: FINISH_LINE_THICKNESS,
    color: FINISH_LINE_COLOR,
  });
  stage.add(finishLine);

  const offset = (stage.width + PUSHER_OVERFLOW_DISTANCE / 2) / NUM_PUSHERS;
  const minTopPusherX =
    -stage.width / 2 + PUSHER_SIZE - PUSHER_OVERFLOW_DISTANCE;
  const maxTopPusherX =
    stage.width / 2 - PUSHER_SIZE + PUSHER_OVERFLOW_DISTANCE;
  const topPushers: RightTriangle[] = [];
  for (let i = 0; i < NUM_PUSHERS; i++) {
    const x = minTopPusherX + offset * i;
    const y = -thirdHeight - WALL_THICKNESS / 2 - PUSHER_SIZE / 2;

    const pusher = new RightTriangle({
      position: [x, y],
      width: PUSHER_SIZE,
      height: PUSHER_SIZE,
      color: PUSHER_COLOR,
      velocity: [40, 0],
    });
    stage.add(pusher);
    topPushers.push(pusher);
  }

  const bottomPushers: RightTriangle[] = [];
  const minBottomPusherX =
    stage.width / 2 - PUSHER_SIZE + PUSHER_OVERFLOW_DISTANCE;
  const maxBottomPusherX =
    -stage.width / 2 + PUSHER_SIZE / 2 - PUSHER_OVERFLOW_DISTANCE;
  for (let i = 0; i < NUM_PUSHERS; i++) {
    const x = minBottomPusherX - offset * i;
    const y = thirdHeight - WALL_THICKNESS / 2 - PUSHER_SIZE / 2;

    const pusher = new RightTriangle({
      position: [x, y],
      rotation: -Math.PI / 2,
      width: PUSHER_SIZE,
      height: PUSHER_SIZE,
      color: PUSHER_COLOR,
      velocity: [-40, 0],
    });
    stage.add(pusher);
    bottomPushers.push(pusher);
  }

  const constrainPushers = () => {
    for (const pusher of topPushers) {
      if (pusher.position[0] > maxTopPusherX) {
        pusher.position[0] = minTopPusherX;
      }
    }
    for (const pusher of bottomPushers) {
      if (pusher.position[0] < maxBottomPusherX) {
        pusher.position[0] = minBottomPusherX;
      }
    }
  };

  // Init
  spawnWalls();

  return {
    stage,
    constrainPushers,
    finishLine,
  };
}

export default main;
