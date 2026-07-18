import { describe, expect, test } from "bun:test";

import {
  MAX_FINISH_ROWS,
  MIN_FINISH_ROWS,
  MAX_FINISH_MARBLE_SCALE,
  createPackedFinishLayout,
  createPackedFinishPlacements,
  finishRackHeightFor,
  largestFittingDivisor,
} from "../src/game/race/finishGrid";

const MARBLE_LADDER = [6, 12, 24, 36, 48, 60, 72, 96, 120];

describe("largestFittingDivisor", () => {
  test("returns the largest divisor at or below the limit", () => {
    expect(largestFittingDivisor(100, 10)).toBe(10);
    expect(largestFittingDivisor(100, 24)).toBe(20);
    expect(largestFittingDivisor(100, 49)).toBe(25);
    expect(largestFittingDivisor(120, 16)).toBe(15);
    expect(largestFittingDivisor(60, 7)).toBe(6);
  });

  test("caps at the value itself and floors fractional limits", () => {
    expect(largestFittingDivisor(6, 100)).toBe(6);
    expect(largestFittingDivisor(100, 10.9)).toBe(10);
  });

  test("returns null when not even one column fits", () => {
    expect(largestFittingDivisor(100, 0.5)).toBe(null);
  });
});

describe("createPackedFinishLayout", () => {
  test("fills each bay exactly with a divisor column count", () => {
    for (const marblesPerTeam of MARBLE_LADDER) {
      for (const bayCount of [2, 4, 7, 12]) {
        const layout = createPackedFinishLayout({
          width: 1440,
          wallThickness: 15,
          bayCount,
          marblesPerTeam,
        });
        expect(marblesPerTeam % layout.columns).toBe(0);
        expect(layout.columns * layout.rows).toBe(marblesPerTeam);
        expect(layout.shrunk).toBe(false);
        // Wide bays grow the radius to fill, never past the cap.
        expect(layout.marbleRadius).toBeGreaterThanOrEqual(4.8);
        expect(layout.marbleRadius).toBeLessThanOrEqual(
          4.8 * MAX_FINISH_MARBLE_SCALE
        );
        // Never loose: columns are exact-fill or crunched, except the
        // degenerate single-row fallback when no divisor spans the bay.
        const loose = layout.columnPitch > layout.pitch + 1e-6;
        if (loose) {
          expect(layout.columns).toBe(marblesPerTeam);
        }
        // The rows floor bends only when the radius cap forced a crunch.
        if (marblesPerTeam >= MIN_FINISH_ROWS && layout.rows < MIN_FINISH_ROWS) {
          expect(layout.marbleRadius).toBeCloseTo(
            4.8 * MAX_FINISH_MARBLE_SCALE
          );
        }
      }
    }
  });

  test("grows the radius slightly so columns fill the bay exactly", () => {
    const layout = createPackedFinishLayout({
      width: 1440,
      wallThickness: 15,
      bayCount: 12,
      marblesPerTeam: 100,
    });
    // Slack between divisor steps is absorbed by the radius, not spacing.
    expect(layout.marbleRadius).toBeGreaterThan(4.8);
    expect(layout.marbleRadius).toBeLessThan(6);
    expect(layout.columnPitch).toBeCloseTo(layout.pitch);
    // First and last columns touch the bay walls.
    expect(
      (layout.columns - 1) * layout.columnPitch + layout.marbleRadius * 2
    ).toBeCloseTo(layout.bayInnerWidth);
  });

  test("crunches columns together when the radius cap cannot span the bay", () => {
    const layout = createPackedFinishLayout({
      width: 1440,
      wallThickness: 15,
      bayCount: 2,
      marblesPerTeam: 100,
    });
    expect(layout.marbleRadius).toBeCloseTo(4.8 * MAX_FINISH_MARBLE_SCALE);
    expect(layout.columns).toBe(25);
    expect(layout.rows).toBe(4);
    // Overlapping, never loose.
    expect(layout.columnPitch).toBeLessThan(layout.pitch);
    expect(
      (layout.columns - 1) * layout.columnPitch + layout.marbleRadius * 2
    ).toBeCloseTo(layout.bayInnerWidth);
  });

  test("caps columns and grows the radius when rows would drop below the floor", () => {
    const layout = createPackedFinishLayout({
      width: 1440,
      wallThickness: 15,
      bayCount: 4,
      marblesPerTeam: 100,
    });
    // 25 columns would fit, but 100/25 = 4 rows is under the floor.
    expect(layout.columns).toBe(20);
    expect(layout.rows).toBe(MIN_FINISH_ROWS);
    expect(layout.marbleRadius).toBeGreaterThan(4.8);
    expect(layout.marbleRadius).toBeLessThanOrEqual(
      4.8 * MAX_FINISH_MARBLE_SCALE
    );
    expect(layout.shrunk).toBe(false);
  });

  test("derives rack height from the row count", () => {
    const layout = createPackedFinishLayout({
      width: 1440,
      wallThickness: 15,
      bayCount: 12,
      marblesPerTeam: 100,
    });
    expect(layout.columns).toBe(10);
    expect(layout.rows).toBe(10);
    expect(layout.gridHeight).toBeCloseTo(10 * layout.pitch - 0.6);
    expect(layout.rackHeight).toBeCloseTo(layout.gridHeight + 30);
    expect(
      finishRackHeightFor({
        width: 1440,
        wallThickness: 15,
        bayCount: 12,
        marblesPerTeam: 100,
      })
    ).toBeCloseTo(layout.rackHeight);
  });

  test("wider bays step columns up and the rack height down", () => {
    const tall = createPackedFinishLayout({
      width: 1440,
      wallThickness: 15,
      bayCount: 12,
      marblesPerTeam: 100,
    });
    const short = createPackedFinishLayout({
      width: 1440,
      wallThickness: 15,
      bayCount: 6,
      marblesPerTeam: 100,
    });
    expect(short.columns).toBe(20);
    expect(short.rows).toBe(5);
    expect(short.rackHeight).toBeLessThan(tall.rackHeight);
  });

  test("shrinks the radius as a last resort when rows would exceed the cap", () => {
    const layout = createPackedFinishLayout({
      width: 480,
      wallThickness: 15,
      bayCount: 12,
      marblesPerTeam: 120,
    });
    expect(layout.shrunk).toBe(true);
    expect(layout.marbleRadius).toBeLessThan(4.8);
    expect(layout.marbleRadius).toBeGreaterThanOrEqual(1.2);
    expect(layout.rows).toBeLessThanOrEqual(MAX_FINISH_ROWS);
    expect(layout.columns * layout.rows).toBe(120);
  });

  test("throws when marbles cannot fit even at the minimum radius", () => {
    expect(() =>
      createPackedFinishLayout({
        width: 100,
        wallThickness: 15,
        bayCount: 5,
        marblesPerTeam: 120,
      })
    ).toThrow();
  });
});

describe("createPackedFinishPlacements", () => {
  const options = {
    position: [0, 0],
    width: 200,
    wallThickness: 10,
    bayCount: 3,
    marblesPerTeam: 12,
    marbleRadius: 4,
    gap: 1,
  };

  test("emits slots for every bay, including unclaimed ones", () => {
    const placements = createPackedFinishPlacements(options);
    expect(placements).toHaveLength(36);
    expect(new Set(placements.map(({ bayIndex }) => bayIndex)).size).toBe(3);
  });

  test("fills row-major from the bottom row up, left to right", () => {
    const layout = createPackedFinishLayout(options);
    const bay = createPackedFinishPlacements(options).filter(
      ({ bayIndex }) => bayIndex === 0
    );
    const bottomRow = bay.slice(0, layout.columns);
    // +Y is down, so the bottom row has the largest y.
    const maxY = Math.max(...bay.map(({ position: [, y] }) => y));
    for (const { position } of bottomRow) {
      expect(position[1]).toBeCloseTo(maxY);
    }
    const xs = bottomRow.map(({ position: [x] }) => x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(xs[1] - xs[0]).toBeCloseTo(layout.columnPitch);
    // The next slot after a full row steps one pitch upward (-Y).
    const nextRow = bay[layout.columns];
    expect(nextRow.position[1]).toBeCloseTo(maxY - layout.pitch);
    expect(nextRow.position[0]).toBeCloseTo(xs[0]);
  });

  test("rests the bottom row on the bottom wall, columns touching bay walls", () => {
    const layout = createPackedFinishLayout(options);
    const bay = createPackedFinishPlacements(options).filter(
      ({ bayIndex }) => bayIndex === 0
    );
    const maxY = Math.max(...bay.map(({ position: [, y] }) => y));
    expect(maxY + layout.marbleRadius).toBeCloseTo(
      layout.rackHeight / 2 - options.wallThickness
    );
    const minX = Math.min(...bay.map(({ position: [x] }) => x));
    const maxX = Math.max(...bay.map(({ position: [x] }) => x));
    const bayLeft = -options.width / 2 + options.wallThickness;
    expect(minX - layout.marbleRadius).toBeCloseTo(bayLeft);
    expect(maxX + layout.marbleRadius).toBeCloseTo(
      bayLeft + layout.bayInnerWidth
    );
  });
});
