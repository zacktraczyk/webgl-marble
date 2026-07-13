import { Circle } from "../engine/object/circle";
import { Rectangle } from "../engine/object/rectangle";
import type { Scene } from "../engine/runtime/scene";
import Stage from "../engine/stage";

function createScene(): Scene {
  const stage = new Stage();
  stage.panAndZoom = true;

  const spawnX = -250;
  const spawnY = -stage.canvas.clientHeight / 2 + 100;

  const circle1 = new Circle({
    position: [spawnX, spawnY],
    radius: 40,
    color: [1, 0, 0, 1],
    physicsType: "dynamic",
  });
  stage.add(circle1);

  const square1 = new Rectangle({
    position: [spawnX - 40, 0],
    width: 100,
    height: 100,
    rotation: Math.PI / 8,
    physicsType: "kinematic",
    color: [0, 1, 0, 1],
  });
  stage.add(square1);

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
      if (circle1.position[1] > stage.canvas.clientHeight + 100) {
        circle1.velocity[0] = 0;
        circle1.velocity[1] = 0;
        circle1.position[0] = spawnX;
        circle1.position[1] = spawnY;
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
