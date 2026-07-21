import { describe, expect, test } from "bun:test";
import { parseVduConfig } from "./config.ts";

describe("VDU benchmark configuration", () => {
  test("applies the smoke preset and explicit scenario options", () => {
    const config = parseVduConfig([
      "--preset",
      "smoke",
      "--scenario",
      "fragmented",
      "--count",
      "120",
      "--gpu",
    ]);
    expect(config.repetitions).toBe(1);
    expect(config.warmupFrames).toBe(60);
    expect(config.scenario).toBe("fragmented");
    expect(config.count).toBe(120);
    expect(config.gpu).toBe(true);
  });

  test("parses a scaling count ramp", () => {
    const config = parseVduConfig(["--suite=scaling", "--counts=100,500,1000"]);
    expect(config.suite).toBe("scaling");
    expect(config.counts).toEqual([100, 500, 1_000]);
  });

  test("requires both cross-build URLs", () => {
    expect(() =>
      parseVduConfig(["--baseline-url", "http://localhost:4321"])
    ).toThrow("must be supplied together");
  });

  test("rejects invalid scenarios and count ramps", () => {
    expect(() => parseVduConfig(["--scenario", "unknown"])).toThrow(
      "Unknown VDU scenario"
    );
    expect(() => parseVduConfig(["--counts", "100,zero"])).toThrow(
      "Invalid --counts entry"
    );
  });
});
