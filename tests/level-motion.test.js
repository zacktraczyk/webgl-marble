import { describe, expect, test } from "bun:test";
import { LevelDocument } from "../src/editor/levelDocument.ts";
import {
  getLevelObjectMotionPose,
  getOscillationEndpoints,
  getRotationPivot,
} from "../src/editor/levelMotion.ts";
import { levelObjectDefinitions } from "../src/game/prefabs/levelObject.ts";
import {
  createPusher,
  PUSHER_DEFAULT_RANGE,
  PUSHER_PERIODS,
} from "../src/scenes/level-builder/courseObjects.ts";
import { SelectedTool } from "../src/scenes/level-builder/types.ts";

const authored = (data, id = "pusher") => ({ ...data, id });

describe("level object motion", () => {
  test("places a slider at the center of its path and reaches both endpoints", () => {
    const slider = authored(createPusher(SelectedTool.Slider, [100, 200]));
    const endpoints = getOscillationEndpoints(slider, 15);

    expect(slider.properties).toMatchObject({
      start: [100, 140],
      end: [100, 260],
    });
    expect(endpoints).toEqual([
      [100 - PUSHER_DEFAULT_RANGE, 200],
      [100 + PUSHER_DEFAULT_RANGE, 200],
    ]);
    expect(getLevelObjectMotionPose(slider, 15, 0).position).toEqual([
      100, 200,
    ]);
    expect(
      getLevelObjectMotionPose(slider, 15, PUSHER_PERIODS.medium / 4).position
    ).toEqual([100 + PUSHER_DEFAULT_RANGE, 200]);
    expect(
      getLevelObjectMotionPose(slider, 15, PUSHER_PERIODS.medium / 2)
        .position[0]
    ).toBeCloseTo(100);
  });

  test("keeps a sweeper pivot fixed at its authored first endpoint", () => {
    const sweeper = authored(createPusher(SelectedTool.Sweeper, [10, 20]));
    const quarterTurn = getLevelObjectMotionPose(
      sweeper,
      15,
      PUSHER_PERIODS.medium / 4
    );

    expect(getRotationPivot(sweeper, 15)).toEqual([10, 20]);
    expect(quarterTurn.position[0]).toBeCloseTo(10);
    expect(quarterTurn.position[1]).toBeCloseTo(80);
    expect(quarterTurn.rotation).toBeCloseTo(Math.PI / 2);
  });

  test("reverses rotating presets without changing their rest pose", () => {
    const spinner = authored(createPusher(SelectedTool.Spinner, [0, 0]));
    spinner.motion.direction = -1;

    const rest = getLevelObjectMotionPose(spinner, 15, 0);
    const quarterTurn = getLevelObjectMotionPose(
      spinner,
      15,
      PUSHER_PERIODS.medium / 4
    );

    expect(rest).toMatchObject({ position: [0, 0], rotation: 0 });
    expect(quarterTurn.rotation).toBeCloseTo(-Math.PI / 2);
  });

  test("spawns moving walls as kinematic physics bodies", () => {
    const slider = authored(createPusher(SelectedTool.Slider, [0, 0]));
    const [definition] = levelObjectDefinitions(slider, { wallThickness: 15 });

    expect(definition.physics?.type).toBe("kinematic");
  });

  test("serializes the motion-ready level format", () => {
    const document = new LevelDocument("Motion course", [800, 800], {
      wallThickness: 15,
    });
    document.add(createPusher(SelectedTool.Slider, [0, 0]));

    expect(document.serialize()).toMatchObject({
      version: 3,
      objects: [{ motion: { type: "oscillate", phase: 0 } }],
    });
  });
});
