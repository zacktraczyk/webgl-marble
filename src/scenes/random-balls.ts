import { GeneralCollisionResolver } from "../engine/physics/collision/general";
import { GJKCollisionDetector } from "../engine/physics/collision/GJK";
import Physics from "../engine/physics/physics";
import type { Scene } from "../engine/runtime/scene";
import Stage from "../engine/stage";
import { marbleDefinition } from "../game/prefabs/marble";
import { rectangleDefinition } from "../game/prefabs/primitives/rectangle";

function createScene(): Scene {
  const { stage } = init();

  return {
    fixedUpdate: (deltaMs) => stage.update(deltaMs),
    render: () => stage.render(),
    dispose: () => stage.dispose(),
  };
}

function init() {
  const gjk = new GJKCollisionDetector();
  const resolver = new GeneralCollisionResolver();
  const physics = new Physics({
    collisionDetector: gjk,
    collisionResolver: resolver,
  });

  const stage = new Stage({ width: 1000, height: 1000, physics });
  stage.panAndZoom = true;

  // Spawn area
  const spawnOriginx = 0;
  const spawnOriginy = 0;
  const spawnPadding = 50;
  const spawnw = stage.width - spawnPadding * 2;
  const spawnh = stage.height - spawnPadding * 2;

  const numSpawnEntities = 80;

  function randomCircleSpawn() {
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

      stage.spawn(
        marbleDefinition({
          position: [x, y],
          velocity: [vx, vy],
          radius: circleSharedProps.radius,
          color: [0, 0, Math.random() * 0.5 + 0.5, 1],
          decorated: false,
        })
      );
    }
  }

  function spawnWalls() {
    const walls: {
      position: [number, number];
      width: number;
      height: number;
    }[] = [
      { position: [0, stage.height / 2 - 25], width: stage.width, height: 50 },
      {
        position: [25 - stage.width / 2, 0],
        width: 50,
        height: stage.height - 100,
      },
      {
        position: [stage.width / 2 - 25, 0],
        width: 50,
        height: stage.height - 100,
      },
      { position: [0, 25 - stage.height / 2], width: stage.width, height: 50 },
    ];
    for (const wall of walls) {
      stage.spawn(rectangleDefinition({ ...wall, color: [0, 1, 0, 1] }));
    }
  }

  // Init
  spawnWalls();
  randomCircleSpawn();

  return {
    stage,
  };
}

export default createScene;
