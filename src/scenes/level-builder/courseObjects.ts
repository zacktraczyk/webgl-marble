import type {
  LevelObjectMotion,
  NewLevelObjectData,
} from "../../editor/levelDocument";
import type { Vec2 } from "../../engine/core/transform";
import {
  STAGING_RACK_HEIGHT,
  STAGING_RACK_WIDTH,
} from "../../game/prefabs/stagingRack";
import { FINISH_RACK_HEIGHT } from "../../game/prefabs/finishZone";
import {
  DEFAULT_SPAWN_DIRECTION_VARIANCE,
  spawnAreaRadius,
} from "../../game/race/spawn";
import { MAX_TEAMS } from "../../game/race/staging";
import {
  COURSE_STROKE_WIDTH,
  DEFAULT_LAUNCH_SPEED,
  FINISH_COLOR,
  MAX_MARBLE_RADIUS,
  SPAWN_COLOR,
  WALL_COLOR,
} from "./constants";
import { SelectedTool, type PusherTool } from "./types";

export const PUSHER_WALL_LENGTH = 120;
export const PUSHER_DEFAULT_RANGE = 90;
export const PUSHER_PERIODS = {
  slow: 4000,
  medium: 2400,
  fast: 1400,
} as const;

const pusherMotion = (tool: PusherTool): LevelObjectMotion => {
  const shared = {
    periodMs: PUSHER_PERIODS.medium,
    phase: 0,
    direction: 1 as const,
  };
  if (tool === SelectedTool.Slider) {
    return {
      type: "oscillate",
      vector: [PUSHER_DEFAULT_RANGE, 0],
      ...shared,
    };
  }
  return {
    type: "rotate",
    pivot: tool === SelectedTool.Sweeper ? "start" : "center",
    ...shared,
  };
};

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

export const createPusher = (
  tool: PusherTool,
  position: Vec2
): NewLevelObjectData => {
  const halfLength = PUSHER_WALL_LENGTH / 2;
  const start: Vec2 =
    tool === SelectedTool.Sweeper
      ? [...position]
      : tool === SelectedTool.Slider
        ? [position[0], position[1] - halfLength]
        : [position[0] - halfLength, position[1]];
  const end: Vec2 =
    tool === SelectedTool.Sweeper
      ? [position[0] + PUSHER_WALL_LENGTH, position[1]]
      : tool === SelectedTool.Slider
        ? [position[0], position[1] + halfLength]
        : [position[0] + halfLength, position[1]];
  return {
    ...createWall(start, end),
    motion: pusherMotion(tool),
  } as NewLevelObjectData;
};

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
    radius: spawnAreaRadius(
      MAX_MARBLE_RADIUS * 2.5,
      MAX_TEAMS,
      MAX_MARBLE_RADIUS
    ),
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
  createSpawnPoint([0, -stageHeight / 2 + MAX_MARBLE_RADIUS * 10]),
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
  const topWallY = -stageHeight / 2 + wallThickness / 2;

  return [
    {
      prefab: "finish-zone",
      locked: true,
      transform: {
        position: [0, stageHeight / 2 - FINISH_RACK_HEIGHT / 2],
      },
      properties: {
        width: stageWidth,
        height: FINISH_RACK_HEIGHT,
        color: [...FINISH_COLOR],
      },
    },
    {
      prefab: "wall",
      locked: true,
      properties: {
        start: [-stageWidth / 2, topWallY],
        end: [stageWidth / 2, topWallY],
        color: [...WALL_COLOR],
      },
    },
    sideWall(-stageWidth / 2 + wallThickness / 2),
    sideWall(stageWidth / 2 - wallThickness / 2),
  ];
};
