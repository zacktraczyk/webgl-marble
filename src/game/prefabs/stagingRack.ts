import type { EntityDefinition } from "../../engine/core/definition";
import type { Vec2 } from "../../engine/core/transform";
import type { Color } from "../../engine/vdu/component";
import { stagingDividerPositions } from "../race/staging";
import { rectangleDefinition } from "./primitives/rectangle";

export const STAGING_RACK_WIDTH = 960;
export const STAGING_RACK_HEIGHT = 230;
export const STAGING_RACK_WALL_THICKNESS = 10;

export interface StagingRackDefinitionOptions {
  position: Vec2;
  teamCount: number;
  width?: number;
  height?: number;
  wallThickness?: number;
  color?: Color;
}

export const stagingRackDefinitions = ({
  position,
  teamCount,
  width = STAGING_RACK_WIDTH,
  height = STAGING_RACK_HEIGHT,
  wallThickness = STAGING_RACK_WALL_THICKNESS,
  color = [113 / 255, 113 / 255, 122 / 255, 1],
}: StagingRackDefinitionOptions): EntityDefinition[] => {
  const rack = { position, width, height, wallThickness };
  const wall = (wallPosition: Vec2, wallWidth: number, wallHeight: number) =>
    rectangleDefinition({
      position: wallPosition,
      width: wallWidth,
      height: wallHeight,
      color,
      tags: ["staging-rack-part", "staging-rack-wall"],
      restitution: 0.2,
    });

  const definitions: EntityDefinition[] = [
    rectangleDefinition({
      position,
      width,
      height,
      color: [24 / 255, 24 / 255, 27 / 255, 0.72],
      physical: false,
      tags: ["staging-rack-part", "staging-rack-background"],
    }),
    wall(
      [position[0], position[1] - height / 2 + wallThickness / 2],
      width,
      wallThickness
    ),
    wall(
      [position[0], position[1] + height / 2 - wallThickness / 2],
      width,
      wallThickness
    ),
    wall(
      [position[0] - width / 2 + wallThickness / 2, position[1]],
      wallThickness,
      height - wallThickness * 2
    ),
    wall(
      [position[0] + width / 2 - wallThickness / 2, position[1]],
      wallThickness,
      height - wallThickness * 2
    ),
  ];

  for (const dividerPosition of stagingDividerPositions(rack, teamCount)) {
    definitions.push(
      wall(dividerPosition, wallThickness, height - wallThickness * 2)
    );
  }
  return definitions;
};
