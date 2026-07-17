import { describe, expect, test } from "bun:test";
import { computeLegStackLayout } from "../src/scenes/race-player/legStack.ts";

const leg = (id, size) => ({
  id,
  name: id,
  level: {
    version: 3,
    name: id,
    size: [...size],
    settings: { wallThickness: 1 },
    objects: [],
  },
});

describe("leg stack layout", () => {
  test("centers leg 0 at the origin", () => {
    const [frame] = computeLegStackLayout([leg("a", [40, 60])]);

    expect(frame.center).toEqual([0, 0]);
    expect(frame.top).toBe(-30);
    expect(frame.bottom).toBe(30);
    expect(frame.size).toEqual([40, 60]);
  });

  test("stacks legs of different sizes edge-to-edge downward", () => {
    const frames = computeLegStackLayout([
      leg("a", [40, 60]),
      leg("b", [20, 100]),
      leg("c", [80, 40]),
    ]);

    expect(frames.map((frame) => frame.index)).toEqual([0, 1, 2]);
    frames.forEach((frame) => expect(frame.center[0]).toBe(0));

    // Edges touch: each top equals the previous bottom.
    expect(frames[1].top).toBe(frames[0].bottom);
    expect(frames[2].top).toBe(frames[1].bottom);

    // Centers offset by the stacked heights.
    expect(frames[0].center).toEqual([0, 0]);
    expect(frames[1].center).toEqual([0, 30 + 50]);
    expect(frames[2].center).toEqual([0, 130 + 20]);

    // top/bottom derive from center and height.
    frames.forEach((frame) => {
      expect(frame.top).toBe(frame.center[1] - frame.size[1] / 2);
      expect(frame.bottom).toBe(frame.center[1] + frame.size[1] / 2);
    });
  });

  test("returns an empty layout for no legs", () => {
    expect(computeLegStackLayout([])).toEqual([]);
  });
});
