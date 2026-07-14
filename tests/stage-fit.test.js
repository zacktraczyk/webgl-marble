import { describe, expect, test } from "bun:test";
import { calculateStageFit } from "../src/engine/stage/fit.ts";

describe("stage fit layout", () => {
  test("uses the largest scale that fits between floating controls", () => {
    const fit = calculateStageFit({
      viewportWidth: 1680,
      viewportHeight: 1026,
      stageWidth: 1440,
      stageHeight: 810,
      insets: { top: 94, right: 12, bottom: 70, left: 12 },
    });

    expect(fit.zoom).toBeCloseTo(862 / 810);
    expect(fit.cameraPosition).toEqual([840, 525]);
  });

  test("honors only the side margins when horizontal space is tighter", () => {
    const fit = calculateStageFit({
      viewportWidth: 1000,
      viewportHeight: 1000,
      stageWidth: 1440,
      stageHeight: 810,
      insets: { top: 94, right: 12, bottom: 70, left: 12 },
    });

    expect(fit.zoom).toBeCloseTo(976 / 1440);
    expect(fit.cameraPosition).toEqual([500, 512]);
  });

  test("centers vertically inside asymmetric toolbar insets", () => {
    const fit = calculateStageFit({
      viewportWidth: 1680,
      viewportHeight: 700,
      stageWidth: 1440,
      stageHeight: 810,
      insets: { top: 70, right: 12, bottom: 60, left: 12 },
    });

    expect(fit.zoom).toBeCloseTo(570 / 810);
    expect(fit.cameraPosition).toEqual([840, 355]);
  });
});
