import { describe, expect, test } from "bun:test";

import { computeEraSchedule } from "../src/game/race/eraSchedule";

const uniformLegs = (count, width = 1440, wallThickness = 15) =>
  Array.from({ length: count }, () => ({ width, wallThickness }));

describe("computeEraSchedule", () => {
  test("requires one leg per elimination", () => {
    expect(() =>
      computeEraSchedule({
        participantCount: 4,
        marblesPerTeam: 60,
        legs: uniformLegs(2),
      })
    ).toThrow();
  });

  test("a 12-team, 100-marble race resets on column steps and radius growth", () => {
    const plans = computeEraSchedule({
      participantCount: 12,
      marblesPerTeam: 100,
      legs: uniformLegs(11),
    });

    expect(plans.map(({ activeTeams }) => activeTeams)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
    ]);
    // Early eras reset on meaningful radius growth (X bays appear in pairs),
    // the 6-team leg resets on a column step (10 -> 20), and per-leg resets
    // follow while marbles keep growing; the final leg hits the 3x radius
    // cap and crunches into 25 columns.
    expect(plans.map(({ bayCount }) => bayCount)).toEqual([
      12, 12, 10, 10, 8, 8, 6, 5, 4, 3, 2,
    ]);
    expect(plans.map(({ columns }) => columns)).toEqual([
      10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 25,
    ]);
    expect(plans.map(({ xBayCount }) => xBayCount)).toEqual([
      0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0,
    ]);
    for (const plan of plans) {
      expect(plan.rows).toBeGreaterThanOrEqual(4);
      expect(plan.marbleRadius).toBeGreaterThanOrEqual(4.8);
      expect(plan.marbleRadius).toBeLessThanOrEqual(4.8 * 3);
    }
  });

  test("layout only changes at era resets, which always clear the X bays", () => {
    const plans = computeEraSchedule({
      participantCount: 12,
      marblesPerTeam: 100,
      legs: uniformLegs(11),
    });
    for (let i = 1; i < plans.length; i++) {
      const reset = plans[i].bayCount !== plans[i - 1].bayCount;
      if (reset) {
        expect(plans[i].xBayCount).toBe(0);
      } else {
        // Within an era (constant width) the grid is frozen.
        expect(plans[i].columns).toBe(plans[i - 1].columns);
        expect(plans[i].marbleRadius).toBeCloseTo(plans[i - 1].marbleRadius);
        expect(plans[i].rackHeight).toBeCloseTo(plans[i - 1].rackHeight);
        expect(plans[i].xBayCount).toBe(plans[i - 1].xBayCount + 1);
      }
    }
  });

  test("every leg's grid stays perfectly divisible", () => {
    for (const marblesPerTeam of [6, 12, 24, 36, 48, 60, 72, 96, 120]) {
      const plans = computeEraSchedule({
        participantCount: 8,
        marblesPerTeam,
        legs: uniformLegs(7),
      });
      for (const plan of plans) {
        expect(plan.columns * plan.rows).toBe(marblesPerTeam);
        expect(plan.bayCount).toBeGreaterThanOrEqual(plan.activeTeams);
      }
    }
  });

  test("evaluates each leg against its own width", () => {
    const legs = [
      { width: 1440, wallThickness: 15 },
      { width: 720, wallThickness: 15 },
      { width: 1440, wallThickness: 15 },
    ];
    const plans = computeEraSchedule({
      participantCount: 4,
      marblesPerTeam: 60,
      legs,
    });
    // Narrower middle leg fits fewer columns in the same era bay count.
    expect(plans[1].columns).toBeLessThanOrEqual(plans[0].columns);
    for (const plan of plans) {
      expect(plan.columns * plan.rows).toBe(60);
    }
  });
});
