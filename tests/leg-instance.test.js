import { describe, expect, test } from "bun:test";
import {
  computeLegCullBounds,
  LEG_BOTTOM_CULL_MARGIN,
  LEG_CULL_PADDING,
} from "../src/scenes/race-player/legInstance.ts";

const frame = (overrides = {}) => ({
  index: 0,
  size: [40, 60],
  center: [0, 0],
  top: -30,
  bottom: 30,
  ...overrides,
});

describe("computeLegCullBounds", () => {
  test("pads the sides and top generously", () => {
    const bounds = computeLegCullBounds(frame());

    expect(bounds.minX).toBe(-20 - LEG_CULL_PADDING);
    expect(bounds.maxX).toBe(20 + LEG_CULL_PADDING);
    expect(bounds.minY).toBe(-30 - LEG_CULL_PADDING);
  });

  test("keeps the bottom tight so escapees never enter the leg below", () => {
    const bounds = computeLegCullBounds(frame());

    expect(bounds.maxY).toBe(30 + LEG_BOTTOM_CULL_MARGIN);
    expect(LEG_BOTTOM_CULL_MARGIN).toBeLessThan(LEG_CULL_PADDING);
  });

  test("tracks an off-origin leg's frame", () => {
    const bounds = computeLegCullBounds(
      frame({ index: 1, center: [0, 90], top: 60, bottom: 120 })
    );

    expect(bounds.minY).toBe(60 - LEG_CULL_PADDING);
    expect(bounds.maxY).toBe(120 + LEG_BOTTOM_CULL_MARGIN);
    expect(bounds.minX).toBe(-20 - LEG_CULL_PADDING);
    expect(bounds.maxX).toBe(20 + LEG_CULL_PADDING);
  });
});
