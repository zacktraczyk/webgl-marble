import { describe, expect, test } from "bun:test";
import { STAGING_RACK_HEIGHT } from "../src/game/prefabs/stagingRack.ts";
import {
  COURSE_STROKE_WIDTH,
  GRID_SIZE,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from "../src/scenes/level-builder/constants.ts";
import {
  createCourseBoundaries,
  createDefaultCourse,
} from "../src/scenes/level-builder/courseObjects.ts";

describe("level builder course boundaries", () => {
  test("uses a larger widescreen default course", () => {
    expect(STAGE_WIDTH).toBe(2400);
    expect(STAGE_HEIGHT).toBe(1350);
    expect(STAGE_WIDTH / STAGE_HEIGHT).toBeCloseTo(16 / 9);
    expect(COURSE_STROKE_WIDTH).toBe(25);
  });

  test("locks the rack and finish zone to the full-width top and bottom edges", () => {
    const width = 2000;
    const height = 3000;
    const [rack, finish] = createCourseBoundaries(width, height);

    expect(rack).toMatchObject({
      prefab: "staging-rack",
      locked: true,
      transform: {
        position: [0, -height / 2 + STAGING_RACK_HEIGHT / 2],
      },
      properties: {
        width,
        height: STAGING_RACK_HEIGHT,
        wallThickness: COURSE_STROKE_WIDTH,
      },
    });
    expect(finish).toMatchObject({
      prefab: "finish-zone",
      locked: true,
      transform: {
        position: [0, height / 2 - COURSE_STROKE_WIDTH / 2],
      },
      properties: { width, height: COURSE_STROKE_WIDTH },
    });
  });

  test("adds locked full-height walls on both sides", () => {
    const width = 2000;
    const height = 3000;
    const [, , leftWall, rightWall] = createCourseBoundaries(width, height);

    expect(leftWall).toMatchObject({
      prefab: "wall",
      locked: true,
      transform: {
        position: [-width / 2 + COURSE_STROKE_WIDTH / 2, 0],
      },
      properties: { width: COURSE_STROKE_WIDTH, height },
    });
    expect(rightWall).toMatchObject({
      prefab: "wall",
      locked: true,
      transform: {
        position: [width / 2 - COURSE_STROKE_WIDTH / 2, 0],
      },
      properties: { width: COURSE_STROKE_WIDTH, height },
    });
  });

  test("derives the shared boundary stroke from one grid cell", () => {
    expect(COURSE_STROKE_WIDTH).toBe(GRID_SIZE);
  });

  test("keeps the spawn point editable in the default course", () => {
    const objects = createDefaultCourse(STAGE_WIDTH, STAGE_HEIGHT);
    const spawnPoint = objects.find(
      (object) => object.prefab === "spawn-point"
    );

    expect(objects.filter((object) => object.locked)).toHaveLength(4);
    expect(spawnPoint?.locked).not.toBe(true);
  });
});
