import { Circle } from "./engine/object/circle";
import { Rectangle } from "./engine/object/rectangle";
import { Collision } from "./engine/physics/collision";
import { PhysicsEventName } from "./engine/physics/observable";
import Physics from "./engine/physics/physics";
import { VDU } from "./engine/vdu/vdu";

const vdu = new VDU("#gl-canvas");
const physics = new Physics();

export default function physScene() {
  wallsSpawn();
  randomCirclesSpawn();
  circleCollisionSpawn();
  circleCollision2Spawn();
  // randomBoxesSpawn();

  // createDeleteCollisionCallback();

  function updateScene() {
    physics.simulate();

    updateFpsPerf();
  }

  function render() {
    updateScene();

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

// Spawn area
const spawnOriginx = vdu.canvas.clientWidth / 2;
const spawnOriginy = vdu.canvas.clientHeight / 2;
const spawnPadding = 50;
const spawnw = vdu.canvas.clientWidth - spawnPadding * 2;
const spawnh = vdu.canvas.clientHeight - spawnPadding * 2;

const numSpawnEntities = 50;

function randomBoxesSpawn() {
  const boxSharedProps = {
    width: 20,
    height: 20,
    type: "dynamic" as const,
  };

  // Spawn boxes
  for (let i = 0; i < numSpawnEntities; i++) {
    const x = spawnOriginx + Math.random() * spawnw - spawnw / 2;
    const y = spawnOriginy + Math.random() * spawnh - spawnh / 2;
    const vx = Math.random() * 200 - 100;
    const vy = Math.random() * 200 - 100;

    const box = new Rectangle({
      position: [x, y],
      velocity: [vx, vy],
      color: [Math.random() * 0.5 + 0.5, 0, 0, 1],
      ...boxSharedProps,
    });
    vdu.add(box);
    physics.add(box);
  }
}

function randomCirclesSpawn() {
  const circleSharedProps = {
    radius: 15,
    type: "dynamic" as const,
  };

  // Spawn circles
  for (let i = 0; i < numSpawnEntities; i++) {
    const x = spawnOriginx + Math.random() * spawnw - spawnw / 2;
    const y = spawnOriginy + Math.random() * spawnh - spawnh / 2;
    const vx = Math.random() * 200 - 100;
    const vy = Math.random() * 200 - 100;

    const circle = new Circle({
      position: [x, y],
      velocity: [vx, vy],
      color: [0, 0, Math.random() * 0.5 + 0.5, 1],
      ...circleSharedProps,
    });
    vdu.add(circle);
    physics.add(circle);
  }
}

function wallsSpawn() {
  const ground = new Rectangle({
    position: [vdu.canvas.clientWidth / 2, vdu.canvas.clientHeight - 25],
    width: vdu.canvas.clientWidth,
    height: 50,
    color: [0, 1, 0, 1],
  });
  vdu.add(ground);
  physics.add(ground);

  const leftWall = new Rectangle({
    position: [25, vdu.canvas.clientHeight / 2],
    width: 50,
    height: vdu.canvas.clientHeight - 100,
    color: [0, 1, 0, 1],
  });
  vdu.add(leftWall);
  physics.add(leftWall);

  const rightWall = new Rectangle({
    position: [vdu.canvas.clientWidth - 25, vdu.canvas.clientHeight / 2],
    width: 50,
    height: vdu.canvas.clientHeight - 100,
    color: [0, 1, 0, 1],
  });
  vdu.add(rightWall);
  physics.add(rightWall);

  const ceiling = new Rectangle({
    position: [vdu.canvas.clientWidth / 2, 25],
    width: vdu.canvas.clientWidth,
    height: 50,
    color: [0, 1, 0, 1],
  });
  vdu.add(ceiling);
  physics.add(ceiling);
}

function circleCollisionSpawn() {
  const circleSharedProps = {
    radius: 15,
    type: "dynamic" as const,
  };

  const c1 = new Circle({
    position: [150, 350],
    velocity: [50, 10],
    color: [0, 0, Math.random() * 0.5 + 0.5, 1],
    ...circleSharedProps,
  });
  vdu.add(c1);
  physics.add(c1);

  const c2 = new Circle({
    position: [480, 310],
    velocity: [-10, 20],
    color: [0, 0, Math.random() * 0.5 + 0.5, 1],
    ...circleSharedProps,
  });
  vdu.add(c2);
  physics.add(c2);
}

function circleCollision2Spawn() {
  const circleSharedProps = {
    radius: 15,
    type: "dynamic" as const,
  };

  const c1 = new Circle({
    position: [300, 450],
    velocity: [5, -40],
    color: [0, 0, Math.random() * 0.5 + 0.5, 1],
    ...circleSharedProps,
  });
  vdu.add(c1);
  physics.add(c1);

  const c2 = new Circle({
    position: [280, 110],
    velocity: [10, 20],
    color: [0, 0, Math.random() * 0.5 + 0.5, 1],
    ...circleSharedProps,
  });
  vdu.add(c2);
  physics.add(c2);
}

const createDeleteCollisionCallback = () => {
  const deleteCollisionCallback = (
    eventName: PhysicsEventName,
    ...data: unknown[]
  ) => {
    if (eventName === "collisions") {
      const collisions = data[0] as Collision[];
      collisions.forEach((collision) => {
        const { entity1, entity2 } = collision;
        const parent1 = entity1.parent as Circle | Rectangle;
        const parent2 = entity2.parent as Circle | Rectangle;

        if (
          !parent1.isMarkedForDeletion &&
          parent1.physicsEntity?.type !== "kinematic"
        ) {
          parent1?.delete();
        }

        if (
          !parent2.isMarkedForDeletion &&
          parent2.physicsEntity?.type !== "kinematic"
        ) {
          parent2?.delete();
        }
      });
    }
  };
  physics.subscribe(deleteCollisionCallback);
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
