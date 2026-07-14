import type { NewLevelObjectData } from "../../editor/levelDocument";
import type { Vec2 } from "../../engine/core/transform";
import {
  STAGING_RACK_HEIGHT,
  STAGING_RACK_WIDTH,
} from "../../game/prefabs/stagingRack";
import { DEFAULT_SPAWN_DIRECTION_VARIANCE } from "../../game/race/spawn";
import {
  BUMPER_COLOR,
  COURSE_STROKE_WIDTH,
  DEFAULT_LAUNCH_SPEED,
  FINISH_COLOR,
  MAX_MARBLE_RADIUS,
  SPAWN_COLOR,
  WALL_COLOR,
} from "./constants";

export const createWall = (
  start: Vec2,
  end: Vec2,
  thickness?: number
): NewLevelObjectData => ({
  prefab: "wall",
  properties: {
    start: [...start],
    end: [...end],
    ...(thickness === undefined ? {} : { thickness }),
    color: [...WALL_COLOR],
  },
});

export const createBumper = (position: Vec2): NewLevelObjectData => ({
  prefab: "bumper",
  transform: { position },
  properties: {
    radius: 22,
    color: [...BUMPER_COLOR],
  },
});

export const createStagingRack = (
  position: Vec2,
  width = STAGING_RACK_WIDTH
): NewLevelObjectData => ({
  prefab: "staging-rack",
  locked: true,
  transform: { position },
  properties: {
    width,
    height: STAGING_RACK_HEIGHT,
    wallThickness: COURSE_STROKE_WIDTH,
    color: [...WALL_COLOR],
  },
});

export const createSpawnPoint = (position: Vec2): NewLevelObjectData => ({
  prefab: "spawn-point",
  transform: { position, rotation: Math.PI / 2 },
  properties: {
    radius: MAX_MARBLE_RADIUS * 2.5,
    color: [...SPAWN_COLOR],
    launchSpeed: DEFAULT_LAUNCH_SPEED,
    directionVariance: DEFAULT_SPAWN_DIRECTION_VARIANCE,
  },
});

export const createDefaultCourse = (
  stageWidth: number,
  stageHeight: number,
  wallThickness = COURSE_STROKE_WIDTH
): NewLevelObjectData[] => [
  ...createCourseBoundaries(stageWidth, stageHeight, wallThickness),
  createSpawnPoint([
    0,
    -stageHeight / 2 + STAGING_RACK_HEIGHT + MAX_MARBLE_RADIUS * 10,
  ]),
];

export const createCourseBoundaries = (
  stageWidth: number,
  stageHeight: number,
  wallThickness = COURSE_STROKE_WIDTH
): NewLevelObjectData[] => {
  const sideWall = (x: number): NewLevelObjectData => ({
    prefab: "wall",
    locked: true,
    properties: {
      start: [x, -stageHeight / 2],
      end: [x, stageHeight / 2],
      color: [...WALL_COLOR],
    },
  });

  return [
    createStagingRack(
      [0, -stageHeight / 2 + STAGING_RACK_HEIGHT / 2],
      stageWidth
    ),
    {
      prefab: "finish-zone",
      locked: true,
      transform: {
        position: [0, stageHeight / 2 - COURSE_STROKE_WIDTH / 2],
      },
      properties: {
        width: stageWidth,
        height: COURSE_STROKE_WIDTH,
        color: [...FINISH_COLOR],
      },
    },
    sideWall(-stageWidth / 2 + wallThickness / 2),
    sideWall(stageWidth / 2 - wallThickness / 2),
  ];
};
