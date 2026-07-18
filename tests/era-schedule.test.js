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

  test("redistributes eliminated teams' marbles to the survivors", () => {
    const plans = computeEraSchedule({
      participantCount: 6,
      marblesPerTeam: 60,
      legs: uniformLegs(5),
    });

    expect(plans.map(({ activeTeams }) => activeTeams)).toEqual([
      6, 5, 4, 3, 2,
    ]);
    // Bays always reflow to the active teams; no X'd bays.
    expect(plans.map(({ bayCount }) => bayCount)).toEqual([6, 5, 4, 3, 2]);
    expect(plans.every(({ xBayCount }) => xBayCount === 0)).toBe(true);
    // Per-team counts grow as the field shrinks, rounded to whole rows.
    expect(plans.map(({ marblesPerTeam }) => marblesPerTeam)).toEqual([
      60, 72, 90, 120, 180,
    ]);
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].marblesPerTeam).toBeGreaterThan(
        plans[i - 1].marblesPerTeam
      );
    }
  });

  test("scales the race's marble radius so small fields keep deep racks", () => {
    const small = computeEraSchedule({
      participantCount: 6,
      marblesPerTeam: 60,
      legs: uniformLegs(5),
    });
    // One constant, larger-than-base radius for the whole race, and no leg
    // (not even the wide final one) drops below six rows.
    const radius = small[0].marbleRadius;
    expect(radius).toBeGreaterThan(4.8);
    expect(radius).toBeLessThanOrEqual(4.8 * 3);
    for (const plan of small) {
      expect(plan.marbleRadius).toBe(radius);
      expect(plan.rows).toBeGreaterThanOrEqual(6);
    }

    // Large fields already stack deep, so they stay at the base radius.
    const large = computeEraSchedule({
      participantCount: 6,
      marblesPerTeam: 360,
      legs: uniformLegs(5),
    });
    expect(large.every(({ marbleRadius }) => marbleRadius === 4.8)).toBe(true);
  });

  test("keeps a constant marble radius and roughly constant rack height", () => {
    const plans = computeEraSchedule({
      participantCount: 12,
      marblesPerTeam: 100,
      legs: uniformLegs(11),
    });
    for (const plan of plans) {
      expect(plan.marbleRadius).toBe(4.8);
      // Bay width scales ~1/teams and count scales ~1/teams, so the row
      // count (and with it the rack height) stays constant on this stage.
      expect(plan.rows).toBe(plans[0].rows);
      expect(plan.rackHeight).toBeCloseTo(plans[0].rackHeight);
    }
  });

  test("every leg's grid fills exactly", () => {
    for (const marblesPerTeam of [12, 36, 60, 100, 120]) {
      const plans = computeEraSchedule({
        participantCount: 8,
        marblesPerTeam,
        legs: uniformLegs(7),
      });
      for (const plan of plans) {
        expect(plan.marblesPerTeam % plan.columns).toBe(0);
        expect(plan.columns * plan.rows).toBe(plan.marblesPerTeam);
        expect(plan.bayCount).toBe(plan.activeTeams);
      }
    }
  });

  test("the first leg stays within one row of the starting count", () => {
    for (const participantCount of [2, 4, 8, 12]) {
      const plans = computeEraSchedule({
        participantCount,
        marblesPerTeam: 60,
        legs: uniformLegs(participantCount - 1),
      });
      expect(Math.abs(plans[0].marblesPerTeam - 60)).toBeLessThanOrEqual(
        plans[0].columns / 2
      );
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
    for (const plan of plans) {
      expect(plan.columns * plan.rows).toBe(plan.marblesPerTeam);
    }
    // The narrower middle leg fits fewer columns per bay.
    expect(plans[1].columns).toBeLessThan(plans[0].columns);
  });
});
