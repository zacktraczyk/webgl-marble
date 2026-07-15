import { describe, expect, test } from "bun:test";
import { RaceController } from "../src/scenes/level-builder/race/index.ts";

describe("race controller", () => {
  test("places an out-of-bounds marble in its team finish bucket", () => {
    const spawned = [];
    let cleared = false;
    const marble = {
      tags: new Set(["team:2"]),
      hasTag: (tag) => tag === "released-marble",
      delete: () => {
        cleared = true;
      },
    };
    const stage = {
      physicsEnabled: false,
      registerPhysicsObserver: () => {},
      update: () => {},
      clearOutOfBoundsEntities: () => [marble],
      spawn: (definition) => {
        spawned.push(definition);
        return { delete: () => {} };
      },
    };
    const level = {
      has: () => true,
    };
    const race = new RaceController(stage, level, {
      teamCount: 2,
      marblesPerTeam: 2,
      releaseIntervalMs: 100,
    });
    race.finishPlacements = [
      { teamIndex: 0, slotIndex: 0, position: [10, 10] },
      { teamIndex: 0, slotIndex: 1, position: [20, 10] },
      { teamIndex: 1, slotIndex: 0, position: [10, 20] },
      { teamIndex: 1, slotIndex: 1, position: [20, 20] },
    ];

    race.fixedUpdate(1000 / 60);

    expect(cleared).toBe(true);
    expect(race.snapshot).toMatchObject({
      finishedMarbles: 1,
      remainingMarbles: 3,
      outOfBoundsMarbles: 1,
    });
    expect(spawned).toHaveLength(1);
    expect(spawned[0]).toMatchObject({
      transform: { position: [10, 20] },
      tags: expect.arrayContaining(["finished-marble", "team:2"]),
      physics: undefined,
    });
  });
});
