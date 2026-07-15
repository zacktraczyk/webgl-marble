import { describe, expect, test } from "bun:test";
import { TEAM_COLORS } from "../src/game/race/staging.ts";
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

  test("maps stable colors and elimination identity without changing local finish bays", () => {
    const spawned = [];
    const marble = {
      tags: new Set(["team:2"]),
      hasTag: (tag) => tag === "released-marble",
      delete: () => {},
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
    const race = new RaceController(
      stage,
      level,
      {
        teamCount: 2,
        marblesPerTeam: 2,
        releaseIntervalMs: 100,
      },
      { stableTeamIndices: [5, 2] }
    );
    race.finishPlacements = [
      { teamIndex: 0, slotIndex: 0, position: [10, 10] },
      { teamIndex: 0, slotIndex: 1, position: [20, 10] },
      { teamIndex: 1, slotIndex: 0, position: [10, 20] },
      { teamIndex: 1, slotIndex: 1, position: [20, 20] },
    ];

    race.fixedUpdate(1000 / 60);
    race.finishTracker.record(0);
    race.finishTracker.record(0);

    expect(spawned[0]).toMatchObject({
      transform: { position: [10, 20] },
      render: { parts: [{ color: TEAM_COLORS[2] }] },
      tags: expect.arrayContaining(["finished-marble", "team:2"]),
    });
    expect(race.snapshot.eliminatedTeamIndex).toBe(2);
  });

  test("uses stable colors for released marbles while retaining local team tags", () => {
    const spawned = [];
    const stage = {
      registerPhysicsObserver: () => {},
      spawn: (definition) => {
        spawned.push(definition);
        return { delete: () => {} };
      },
    };
    const level = {
      find: () => ({
        transform: { position: [0, 0], rotation: 0 },
        properties: { directionVariance: 0, launchSpeed: 0 },
      }),
    };
    const race = new RaceController(
      stage,
      level,
      {
        teamCount: 2,
        marblesPerTeam: 1,
        releaseIntervalMs: 100,
      },
      { stableTeamIndices: [5, 2] }
    );
    race.releaseQueue = {
      takeNext: () => ({ teamIndex: 0 }),
    };

    race.releaseNextMarble([0, 0]);

    expect(spawned[0]).toMatchObject({
      render: { parts: [{ color: TEAM_COLORS[5] }] },
      tags: expect.arrayContaining(["race-marble", "team:1"]),
    });
  });

  test("rejects invalid stable team mappings", () => {
    const stage = {
      registerPhysicsObserver: () => {},
    };
    const level = {};
    const configuration = {
      teamCount: 2,
      marblesPerTeam: 1,
      releaseIntervalMs: 100,
    };
    const createRace = (stableTeamIndices) =>
      new RaceController(stage, level, configuration, { stableTeamIndices });

    expect(() => createRace([0])).toThrow("exactly 2 teams");
    expect(() => createRace([0, TEAM_COLORS.length])).toThrow(
      "Unknown stable team index"
    );
    expect(() => createRace([0, 0])).toThrow("Duplicate stable team index");
  });
});
