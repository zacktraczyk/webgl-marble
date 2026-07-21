import { describe, expect, test } from "bun:test";
import { PNG } from "pngjs";
import { compareVisualSnapshots, createVisualDiffPng } from "./metrics.ts";

const snapshot = (red) => {
  const png = new PNG({ width: 1, height: 1 });
  png.data.set([red, 0, 0, 255]);
  return {
    width: 1,
    height: 1,
    pngDataUrl: `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`,
  };
};

describe("VDU visual comparison", () => {
  test("accepts identical canvas pixels", () => {
    const baseline = snapshot(255);
    expect(compareVisualSnapshots(baseline, baseline)).toMatchObject({
      equivalent: true,
      differingPixels: 0,
      differenceRatio: 0,
    });
  });

  test("reports changed pixels and creates a PNG diff", () => {
    const baseline = snapshot(255);
    const candidate = snapshot(0);
    expect(compareVisualSnapshots(baseline, candidate)).toMatchObject({
      equivalent: false,
      differingPixels: 1,
      differenceRatio: 1,
    });
    expect(
      PNG.sync.read(createVisualDiffPng(baseline, candidate))
    ).toMatchObject({
      width: 1,
      height: 1,
    });
  });
});
