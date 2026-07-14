import { describe, expect, test } from "bun:test";
import {
  applyLevelObjectShape,
  getLevelObjectShape,
  getResizeAnchors,
  hitTestLevelObject,
  moveShape,
  pickLevelObject,
  resizeShape,
} from "../src/editor/levelGeometry.ts";

const wall = (overrides = {}) => ({
  id: "wall",
  prefab: "wall",
  transform: { position: [0, 0], rotation: 0 },
  properties: { width: 100, height: 40, color: [1, 1, 1, 1] },
  ...overrides,
});

describe("level editor geometry", () => {
  test("hit-tests rotated authored objects in local coordinates", () => {
    const rotatedWall = wall({
      transform: { position: [20, 30], rotation: Math.PI / 2 },
    });

    expect(hitTestLevelObject(rotatedWall, [20, 75])).toBe(true);
    expect(hitTestLevelObject(rotatedWall, [55, 30])).toBe(false);
  });

  test("picks the last matching authored object as the topmost item", () => {
    const bottom = wall({ id: "bottom" });
    const top = wall({ id: "top" });

    expect(pickLevelObject([bottom, top], [0, 0])?.id).toBe("top");
  });

  test("moves objects with optional grid snapping", () => {
    const shape = getLevelObjectShape(wall());

    expect(moveShape(shape, [37, -38], 25).position).toEqual([25, -50]);
    expect(moveShape(shape, [37, -38]).position).toEqual([37, -38]);
  });

  test("resizes a rectangle while keeping the opposite edge fixed", () => {
    const object = wall();
    const shape = getLevelObjectShape(object);
    const resized = resizeShape(shape, "e", [82, 0], 5);

    expect(resized).toMatchObject({
      kind: "rectangle",
      position: [15, 0],
      width: 130,
      height: 40,
    });
    applyLevelObjectShape(object, resized);
    expect(object.transform.position).toEqual([15, 0]);
    expect(object.properties.width).toBe(130);
  });

  test("provides eight rectangle anchors and four uniform circle anchors", () => {
    const bumper = {
      id: "bumper",
      prefab: "bumper",
      transform: { position: [0, 0] },
      properties: { radius: 22, color: [1, 1, 1, 1] },
    };

    expect(getResizeAnchors(getLevelObjectShape(wall()))).toHaveLength(8);
    expect(getResizeAnchors(getLevelObjectShape(bumper))).toHaveLength(4);
    expect(
      resizeShape(getLevelObjectShape(bumper), "e", [37, 0], 5)
    ).toMatchObject({ radius: 35 });
  });
});
