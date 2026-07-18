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
    // Era 1: 12 bays @ C=10. Reset at 6 teams (columns step 10 -> 20), then
    // per-leg resets while the min-rows radius keeps growing, until the 2x
    // radius cap ends the growth (3 bays carry into the final leg).
    expect(plans.map(({ bayCount }) => bayCount)).toEqual([
      12, 12, 12, 12, 12, 12, 6, 5, 4, 3, 3,
    ]);
    expect(plans.map(({ columns }) => columns)).toEqual([
      10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20,
    ]);
    expect(plans.map(({ xBayCount }) => xBayCount)).toEqual([
      0, 1, 2, 3, 4, 5, 0, 0, 0, 0, 1,
    ]);
    // Rows never drop below the floor; radius never exceeds the cap.
    for (const plan of plans) {
      expect(plan.rows).toBeGreaterThanOrEqual(5);
      expect(plan.marbleRadius).toBeGreaterThanOrEqual(4.8);
      expect(plan.marbleRadius).toBeLessThanOrEqual(9.6);
    }
    // Radius is non-decreasing as the field shrinks.
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].marbleRadius).toBeGreaterThanOrEqual(
        plans[i - 1].marbleRadius - 1e-9
      );
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
