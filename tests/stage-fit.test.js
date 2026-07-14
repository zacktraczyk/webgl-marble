import { describe, expect, test } from "bun:test";
import { calculateStageFitZoom } from "../src/engine/stage/fit.ts";

describe("stage fit zoom", () => {
  test("snaps a near-native laptop fit to 100%", () => {
    expect(
      calculateStageFitZoom({
        viewportWidth: 1680,
        viewportHeight: 1026,
        stageWidth: 1440,
        stageHeight: 810,
        padding: 128,
        snapToNativeZoom: true,
      })
    ).toBe(1);
  });

  test("keeps fitting substantially larger courses to the viewport", () => {
    expect(
      calculateStageFitZoom({
        viewportWidth: 1680,
        viewportHeight: 1026,
        stageWidth: 2400,
        stageHeight: 1350,
        padding: 128,
      })
    ).toBeCloseTo(0.57037);
  });
});
