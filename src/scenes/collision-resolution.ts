import Stage from "../engine/stage";
import { Ball } from "../engine/object/ball";
import { GJKCollisionDetector } from "../engine/physics/collision/GJK";
import Physics from "../engine/physics/physics";
import { GeneralCollisionResolver } from "../engine/physics/collision/general";
import type { Scene } from "../engine/runtime/scene";

function createScene(): Scene {
  const gjk = new GJKCollisionDetector();
  const resolver = new GeneralCollisionResolver();
  const physics = new Physics({
    collisionDetector: gjk,
    collisionResolver: resolver,
  });
  const stage = new Stage({ physics });
  stage.panAndZoom = true;

  // const spawnX = -250;
  // const spawnY = -stage.canvas.clientHeight / 2 + 100;

  const CENTER_X = 0;
  const CENTER_Y = -stage.canvas.clientHeight / 4;
  const OFFSET = 100;
  const INITIAL_VELOCITY_1 = 70;
  const INITIAL_VELOCITY_2 = -70 + 50;

  const circle1 = new Ball({
    position: [CENTER_X - OFFSET, CENTER_Y],
    velocity: [INITIAL_VELOCITY_1, 0],
    radius: 40,
    color: [1, 0, 0, 1],
    physicsType: "dynamic",
  });
  stage.add(circle1);

  const circle2 = new Ball({
    position: [CENTER_X + OFFSET, CENTER_Y],
    velocity: [INITIAL_VELOCITY_2, 0],
    radius: 40,
    color: [1, 0, 0, 1],
    physicsType: "dynamic",
  });
  stage.add(circle2);

  // const square1 = new Rectangle({
  //   position: [spawnX - 40, 0],
  //   width: 100,
  //   height: 100,
  //   rotation: Math.PI / 8,
  //   physicsType: "kinematic",
  //   color: [0, 1, 0, 1],
  // });
  // stage.add(square1);

  const shouldReset = () => {
    const circle1Outside =
      circle1.position[0] > stage.canvas.clientWidth / 2 ||
      circle1.position[0] < -stage.canvas.clientWidth / 2 ||
      circle1.position[1] > stage.canvas.clientHeight / 2 ||
      circle1.position[1] < -stage.canvas.clientHeight / 2;
    const circle2Outside =
      circle2.position[0] > stage.canvas.clientWidth / 2 ||
      circle2.position[0] < -stage.canvas.clientWidth / 2 ||
      circle2.position[1] > stage.canvas.clientHeight / 2 ||
      circle2.position[1] < -stage.canvas.clientHeight / 2;

    return circle1Outside || circle2Outside;
  };

  const resetObjects = () => {
    circle1.position[0] = CENTER_X - OFFSET;
    circle1.position[1] = CENTER_Y;
    circle1.velocity[0] = INITIAL_VELOCITY_1;
    circle1.velocity[1] = 0;

    circle2.position[0] = CENTER_X + OFFSET;
    circle2.position[1] = CENTER_Y;
    circle2.velocity[0] = INITIAL_VELOCITY_2;
    circle2.velocity[1] = 0;
  };

  const collisions: [number, number][] = [];
  stage.registerPhysicsObserver(({ entityCollisions }) => {
    for (const collision of entityCollisions) {
      const { entity1, entity2 } = collision;
      const alreadyCollided = collisions.some(
        (pair) => pair[0] === entity1 && pair[1] === entity2
      );
      if (alreadyCollided) {
        continue;
      }

      collisions.push([entity1, entity2]);
    }
  });

  return {
    fixedUpdate: (deltaMs) => {
      if (shouldReset()) {
        resetObjects();
      }
      stage.update(deltaMs);
    },
    update: () => {
      updateDebugInfo({ collisions });
    },
    render: () => stage.render(),
    dispose: () => stage.dispose(),
  };
}

// Debug info
const debugInfoElem = document.getElementById("#debug-info");
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const updateDebugInfo = (obj: any) => {
  if (debugInfoElem) {
    debugInfoElem.textContent = JSON.stringify(obj, null, 2);
  }
};

export default createScene;
