import { describe, expect, test } from "bun:test";
import { GridOverlay } from "../src/scenes/level-builder/gridOverlay.ts";

const createGridOverlay = () => {
  const properties = new Map();
  const stage = {
    width: 400,
    height: 200,
    zoom: 2,
    worldToScreen: () => [12, 24],
  };
  const majorToggle = { dataset: {} };
  const minorToggle = { dataset: {} };
  const overlay = {
    dataset: {},
    hidden: false,
    style: {
      setProperty: (name, value) => properties.set(name, value),
    },
  };
  const grid = new GridOverlay(stage, majorToggle, minorToggle, overlay);
  return { grid, majorToggle, minorToggle, overlay, properties };
};

describe("level builder grid overlay", () => {
  test("starts with major lines visible and minor lines hidden", () => {
    const { grid, majorToggle, minorToggle, overlay, properties } =
      createGridOverlay();

    grid.update();

    expect(majorToggle.ariaChecked).toBe("true");
    expect(majorToggle.dataset.active).toBe("true");
    expect(minorToggle.ariaChecked).toBe("false");
    expect(minorToggle.dataset.active).toBe("false");
    expect(overlay.dataset.majorVisible).toBe("true");
    expect(overlay.dataset.minorVisible).toBe("false");
    expect(overlay.hidden).toBe(false);
    expect(properties.get("--grid-step")).toBe("50px");
    expect(properties.get("--grid-major-step")).toBe("200px");
  });

  test("toggles each grid layer independently and suppresses both in playback", () => {
    const { grid, majorToggle, minorToggle, overlay } = createGridOverlay();

    grid.toggleMinor();
    grid.toggleMajor();
    expect(majorToggle.ariaChecked).toBe("false");
    expect(minorToggle.ariaChecked).toBe("true");
    expect(overlay.hidden).toBe(false);

    grid.setSuppressed(true);
    grid.update();
    expect(overlay.hidden).toBe(true);

    grid.setSuppressed(false);
    grid.update();
    expect(overlay.hidden).toBe(false);

    grid.toggleMinor();
    expect(overlay.hidden).toBe(true);
  });
});
