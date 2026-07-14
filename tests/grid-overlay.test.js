import { describe, expect, test } from "bun:test";
import { GridOverlay } from "../src/scenes/level-builder/gridOverlay.ts";

const createGridOverlay = (bounds = { min: [-177, -57], max: [169, 81] }) => {
  const properties = new Map();
  const worldPoints = [];
  const stage = {
    width: 400,
    height: 200,
    zoom: 2,
    worldToScreen: (x, y) => {
      worldPoints.push([x, y]);
      return [x * 2 + 400, y * 2 + 200];
    },
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
  const grid = new GridOverlay(
    stage,
    majorToggle,
    minorToggle,
    overlay,
    () => bounds
  );
  return {
    grid,
    majorToggle,
    minorToggle,
    overlay,
    properties,
    worldPoints,
  };
};

describe("level builder grid overlay", () => {
  test("aligns its bounds to the playable course while preserving snap coordinates", () => {
    const { grid, majorToggle, minorToggle, overlay, properties, worldPoints } =
      createGridOverlay();

    grid.update();

    expect(majorToggle.ariaChecked).toBe("true");
    expect(majorToggle.dataset.active).toBe("true");
    expect(minorToggle.ariaChecked).toBe("false");
    expect(minorToggle.dataset.active).toBe("false");
    expect(overlay.dataset.majorVisible).toBe("true");
    expect(overlay.dataset.minorVisible).toBe("false");
    expect(overlay.hidden).toBe(false);
    expect(worldPoints).toEqual([[-177, -57]]);
    expect(overlay.style.left).toBe("46px");
    expect(overlay.style.top).toBe("86px");
    expect(overlay.style.width).toBe("692px");
    expect(overlay.style.height).toBe("276px");
    expect(properties.get("--grid-step")).toBe("30px");
    expect(properties.get("--grid-major-step")).toBe("60px");
    expect(properties.get("--grid-minor-offset-x")).toBe("24px");
    expect(properties.get("--grid-minor-offset-y")).toBe("24px");
    expect(properties.get("--grid-major-offset-x")).toBe("24px");
    expect(properties.get("--grid-major-offset-y")).toBe("24px");
  });

  test("aligns major columns and rows with every default course boundary", () => {
    const { grid, properties } = createGridOverlay({
      min: [-705, -270],
      max: [705, 390],
    });

    grid.update();

    expect(properties.get("--grid-minor-offset-x")).toBe("0px");
    expect(properties.get("--grid-minor-offset-y")).toBe("0px");
    expect(properties.get("--grid-major-offset-x")).toBe("0px");
    expect(properties.get("--grid-major-offset-y")).toBe("0px");
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
