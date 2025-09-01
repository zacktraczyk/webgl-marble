import { Circle } from "../engine/object/circle";
import { Rectangle } from "../engine/object/rectangle";
import Stage from "../engine/stage";

type Color = [number, number, number, number];

const MARBEL_COLOR: Color = [56 / 255, 189 / 255, 248 / 255, 1];
const MARBEL_RADIUS = 15;

const WALL_THICKNESS = 50;
const WALL_COLOR: Color = [34 / 255, 197 / 255, 94 / 255, 1];
const SQUARE_COLOR: Color = [1, 1, 1, 1];

const FINISH_LINE_THICKNESS = 25;
const FINISH_LINE_COLOR: Color = [239 / 255, 68 / 255, 68 / 255, 1];

function main() {
  const { stage, finishLine } = init();

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

  const numMarbles = 100;
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
  stage.fitStageToWindow(50);

  const gapWidth = stage.width / 6;
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

    const thirdHeight = stage.height / 6;

    const secondFloor = new Rectangle({
      position: [-gapWidth / 2, -thirdHeight],
      width: stage.width - gapWidth,
      height: WALL_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(secondFloor);

    const firstFloor = new Rectangle({
      position: [gapWidth / 2, thirdHeight],
      width: stage.width - gapWidth,
      height: WALL_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(firstFloor);

    const bottomFloor = new Rectangle({
      position: [-gapWidth / 2, stage.height - 25 - stage.height / 2],
      width: stage.width - gapWidth,
      height: WALL_THICKNESS,
      color: WALL_COLOR,
    });
    stage.add(bottomFloor);
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

  // Init
  spawnWalls();

  return {
    stage,
    finishLine,
  };
}

export default main;
