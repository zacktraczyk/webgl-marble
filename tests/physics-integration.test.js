import { describe, expect, test } from "bun:test";
import { createTransform } from "../src/engine/core/transform";
import Physics from "../src/engine/physics/physics";

const collider = { type: "circle", radius: 1 };

describe("Physics integration", () => {
  test("integrates dynamic and kinematic rotation while keeping static bodies fixed", () => {
    const steps = [];
    let resolverCleared = false;
    const physics = new Physics({
      collisionDetector: {
        detectCollision: () => null,
        detectCollisions: () => [],
      },
      collisionResolver: {
        resolveCollisions: (collisions, deltaSeconds) => {
          expect(collisions).toEqual([]);
          steps.push(deltaSeconds);
        },
        clear: () => {
          resolverCleared = true;
        },
      },
    });

    const staticTransform = createTransform({ position: [0, 0] });
    const kinematicTransform = createTransform({ position: [0, 0] });
    const dynamicTransform = createTransform({ position: [0, 0] });
    physics.addEntity(1, staticTransform, {
      type: "static",
      velocity: [10, 0],
      angularVelocity: 2,
      collider,
    });
    const kinematic = physics.addEntity(2, kinematicTransform, {
      type: "kinematic",
      velocity: [10, 0],
      acceleration: [5, 0],
      angularVelocity: 2,
      collider,
    });
    physics.addEntity(3, dynamicTransform, {
      type: "dynamic",
      velocity: [10, 0],
      angularVelocity: 2,
      collider,
    });

    physics.update(10);

    expect(staticTransform.position).toEqual([0, 0]);
    expect(staticTransform.rotation).toBe(0);
    expect(kinematic.velocity[0]).toBeCloseTo(10.4);
    expect(kinematicTransform.position[0]).toBeCloseTo(0.832);
    expect(kinematicTransform.rotation).toBeCloseTo(0.16);
    expect(dynamicTransform.position[0]).toBeCloseTo(0.8);
    expect(dynamicTransform.position[1]).toBeCloseTo(0.06272);
    expect(dynamicTransform.rotation).toBeCloseTo(0.16);
    expect(steps).toEqual([0.08]);

    physics.dispose();
    expect(resolverCleared).toBe(true);
  });

  test("rejects non-finite frame durations and ignores zero-duration updates", () => {
    let solveCount = 0;
    const physics = new Physics({
      collisionDetector: {
        detectCollision: () => null,
        detectCollisions: () => [],
      },
      collisionResolver: {
        resolveCollisions: () => {
          solveCount++;
        },
      },
    });

    physics.update(0);

    expect(solveCount).toBe(0);
    expect(() => physics.update(Number.NaN)).toThrow();
  });
});
