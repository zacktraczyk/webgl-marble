import type { NewLevelObjectData } from "../../editor/levelDocument";
import type { Vec2 } from "../../engine/core/transform";
import {
  STAGING_RACK_HEIGHT,
  STAGING_RACK_WALL_THICKNESS,
  STAGING_RACK_WIDTH,
} from "../../game/prefabs/stagingRack";
import {
  BUMPER_COLOR,
  DEFAULT_LAUNCH_SPEED,
  FINISH_COLOR,
  FINISH_LINE_HEIGHT,
  MAX_MARBLE_RADIUS,
  SPAWN_COLOR,
  WALL_COLOR,
} from "./constants";

export const createWall = (position: Vec2): NewLevelObjectData => ({
  prefab: "wall",
  transform: { position },
  properties: {
    width: 150,
    height: 25,
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

export const createStagingRack = (position: Vec2): NewLevelObjectData => ({
  prefab: "staging-rack",
  transform: { position },
  properties: {
    width: STAGING_RACK_WIDTH,
    height: STAGING_RACK_HEIGHT,
    wallThickness: STAGING_RACK_WALL_THICKNESS,
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
  },
});

export const createDefaultCourse = (
  stageWidth: number,
  stageHeight: number
): NewLevelObjectData[] => [
  {
    prefab: "finish-zone",
    transform: {
      position: [0, stageHeight / 2 - FINISH_LINE_HEIGHT / 2],
    },
    properties: {
      width: stageWidth,
      height: FINISH_LINE_HEIGHT,
      color: [...FINISH_COLOR],
    },
  },
  createStagingRack([0, -250]),
  createSpawnPoint([0, -75]),
];
