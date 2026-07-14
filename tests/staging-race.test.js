import { describe, expect, test } from "bun:test";
import {
  createStagingMarblePlacements,
  fitStagingMarbleRadius,
  RoundRobinReleaseQueue,
  stagingDividerPositions,
} from "../src/game/race/staging";
import {
  STAGING_RACK_HEIGHT,
  STAGING_RACK_WALL_THICKNESS,
  STAGING_RACK_WIDTH,
} from "../src/game/prefabs/stagingRack";

const rack = {
  position: [0, -250],
  width: STAGING_RACK_WIDTH,
  height: STAGING_RACK_HEIGHT,
  wallThickness: STAGING_RACK_WALL_THICKNESS,
};

const seededRandom = (initialSeed) => {
  let seed = initialSeed;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
};

describe("staging rack", () => {
  test("generates one divider between each active team bay", () => {
    const dividers = stagingDividerPositions(rack, 4);

    expect(dividers).toHaveLength(3);
    expect(dividers.map(([x]) => x)).toEqual([-141, 0, 141]);
    expect(dividers.every(([, y]) => y === rack.position[1])).toBe(true);
  });

  test("fits twenty marbles in each of twelve fixed-size team bays", () => {
    const placements = createStagingMarblePlacements({
      ...rack,
      teamCount: 12,
      marblesPerTeam: 20,
      marbleRadius: 4.8,
      random: seededRandom(42),
    });

    expect(placements).toHaveLength(240);
    for (let teamIndex = 0; teamIndex < 12; teamIndex++) {
      const teamPlacements = placements.filter(
        (placement) => placement.teamIndex === teamIndex
      );
      expect(teamPlacements).toHaveLength(20);
      for (let first = 0; first < teamPlacements.length; first++) {
        for (let second = first + 1; second < teamPlacements.length; second++) {
          const [firstX, firstY] = teamPlacements[first].position;
          const [secondX, secondY] = teamPlacements[second].position;
          expect(
            Math.hypot(firstX - secondX, firstY - secondY)
          ).toBeGreaterThan(9.6);
        }
      }
    }
    expect(
      new Set(placements.map(({ position }) => position.join(","))).size
    ).toBe(placements.length);
    expect(
      placements.some(({ position: [x, y] }) =>
        [x, y].some((coordinate) => !Number.isInteger(coordinate))
      )
    ).toBe(true);
  });

  test("rejects a round that cannot fit in the fixed rack", () => {
    expect(() =>
      createStagingMarblePlacements({
        ...rack,
        teamCount: 12,
        marblesPerTeam: 31,
        marbleRadius: 4.8,
        random: seededRandom(42),
      })
    ).toThrow("fits 30 marbles per team");
  });

  test("fits one hundred marbles per team by adapting their shared radius", () => {
    const marbleRadius = fitStagingMarbleRadius({
      ...rack,
      teamCount: 12,
      marblesPerTeam: 100,
      gap: 0.6,
    });
    const placements = createStagingMarblePlacements({
      ...rack,
      teamCount: 12,
      marblesPerTeam: 100,
      marbleRadius,
      gap: 0.6,
      distribution: "stacked",
      random: seededRandom(100),
    });

    expect(marbleRadius).toBe(2.55);
    expect(placements).toHaveLength(1200);
    const firstTeam = placements.filter(({ teamIndex }) => teamIndex === 0);
    for (let first = 0; first < firstTeam.length; first++) {
      for (let second = first + 1; second < firstTeam.length; second++) {
        const [firstX, firstY] = firstTeam[first].position;
        const [secondX, secondY] = firstTeam[second].position;
        expect(Math.hypot(firstX - secondX, firstY - secondY)).toBeGreaterThan(
          marbleRadius * 2
        );
      }
    }
  });

  test("creates a deterministic, slightly irregular stack at the bottom of each bay", () => {
    const options = {
      ...rack,
      teamCount: 6,
      marblesPerTeam: 12,
      marbleRadius: 4.8,
      gap: 0.6,
      distribution: "stacked",
    };
    const firstLayout = createStagingMarblePlacements({
      ...options,
      random: seededRandom(314),
    });
    const repeatedLayout = createStagingMarblePlacements({
      ...options,
      random: seededRandom(314),
    });

    expect(firstLayout).toEqual(repeatedLayout);
    expect(firstLayout).toHaveLength(72);
    expect(
      firstLayout.every(({ position: [, y] }) => y > rack.position[1])
    ).toBe(true);
    expect(
      new Set(
        firstLayout
          .filter(({ teamIndex }) => teamIndex === 0)
          .map(({ position: [x] }) => (x % 17).toFixed(3))
      ).size
    ).toBeGreaterThan(4);
    expect(
      firstLayout.some(({ position: [x, y] }) =>
        [x, y].some((coordinate) => !Number.isInteger(coordinate))
      )
    ).toBe(true);

    const firstTeam = firstLayout.filter(({ teamIndex }) => teamIndex === 0);
    for (let first = 0; first < firstTeam.length; first++) {
      for (let second = first + 1; second < firstTeam.length; second++) {
        const [firstX, firstY] = firstTeam[first].position;
        const [secondX, secondY] = firstTeam[second].position;
        expect(Math.hypot(firstX - secondX, firstY - secondY)).toBeGreaterThan(
          9.6
        );
      }
    }
  });
});

describe("round-robin release queue", () => {
  test("rotates teams and skips queues that have emptied", () => {
    const releases = new RoundRobinReleaseQueue(
      [["a1", "a2"], ["b1"], ["c1", "c2"]],
      1
    );

    expect([
      releases.takeNext(),
      releases.takeNext(),
      releases.takeNext(),
      releases.takeNext(),
      releases.takeNext(),
    ]).toEqual(["b1", "c1", "a1", "c2", "a2"]);
    expect(releases.remaining).toBe(0);
    expect(releases.takeNext()).toBeNull();
  });
});
