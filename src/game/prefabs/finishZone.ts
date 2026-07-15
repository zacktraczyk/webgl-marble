import type { EntityDefinition } from "../../engine/core/definition";
import type { Vec2 } from "../../engine/core/transform";
import type { Color } from "../../engine/vdu/component";
import { createFinishGridLayout } from "../race/finishGrid";
import { rectangleDefinition } from "./primitives/rectangle";

export const FINISH_RACK_HEIGHT = 135;

const FINISH_LIGHT_COLOR: Color = [244 / 255, 244 / 255, 245 / 255, 1];
const FINISH_DARK_COLOR: Color = [39 / 255, 39 / 255, 42 / 255, 1];
const FINISH_RACK_BACKGROUND: Color = [9 / 255, 9 / 255, 11 / 255, 0.86];
const FINISH_RACK_WALL: Color = [113 / 255, 113 / 255, 122 / 255, 1];

const worldPosition = (
  position: Vec2,
  rotation: number,
  [localX, localY]: Vec2
): Vec2 => {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    position[0] + localX * cosine - localY * sine,
    position[1] + localX * sine + localY * cosine,
  ];
};

export const finishZoneDefinition = ({
  position,
  rotation = 0,
  width,
  height,
  color = [1, 1, 1, 1],
}: {
  position: Vec2;
  rotation?: number;
  width: number;
  height: number;
  color?: Color;
}): EntityDefinition => {
  const definition = rectangleDefinition({
    position,
    rotation,
    width,
    height,
    color,
    bodyType: "kinematic",
    sensor: true,
    tags: ["finish-zone"],
  });

  const checkerSize = height / 2;
  const columnCount = Math.ceil(width / checkerSize);
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < columnCount; column++) {
      const left = -width / 2 + column * checkerSize;
      const cellWidth = Math.min(checkerSize, width / 2 - left);
      definition.render?.parts.push({
        primitive: { type: "rectangle", width: 1, height: 1 },
        color:
          (row + column) % 2 === 0 ? FINISH_LIGHT_COLOR : FINISH_DARK_COLOR,
        localTransform: {
          position: [
            left + cellWidth / 2,
            -height / 2 + checkerSize * (row + 0.5),
          ],
          scale: [cellWidth, checkerSize],
        },
      });
    }
  }

  return definition;
};

export const finishRackDefinitions = ({
  position,
  rotation = 0,
  width,
  height = FINISH_RACK_HEIGHT,
  wallThickness,
  teamCount,
  marblesPerTeam = 100,
  maximumMarbleRadius = 4.8,
  minimumMarbleRadius = 1.2,
  marbleGap = 0.6,
  color,
}: {
  position: Vec2;
  rotation?: number;
  width: number;
  height?: number;
  wallThickness: number;
  teamCount: number;
  marblesPerTeam?: number;
  maximumMarbleRadius?: number;
  minimumMarbleRadius?: number;
  marbleGap?: number;
  color: Color;
}): EntityDefinition[] => {
  const finishBayCount = teamCount;
  const layout = createFinishGridLayout({
    position,
    rotation,
    width,
    height,
    wallThickness,
    teamCount,
    marblesPerTeam,
    maximumRadius: maximumMarbleRadius,
    minimumRadius: minimumMarbleRadius,
    gap: marbleGap,
  });
  const rackLeft = -layout.rackWidth / 2;
  const gridCenterY = -height / 2 + wallThickness + layout.gridHeight / 2;
  const bottomWallY =
    -height / 2 + wallThickness + layout.gridHeight + wallThickness / 2;
  const wall = (
    localPosition: Vec2,
    wallWidth: number,
    wallHeight: number,
    tags: string[],
    physical = true
  ) =>
    rectangleDefinition({
      position: worldPosition(position, rotation, localPosition),
      rotation,
      width: wallWidth,
      height: wallHeight,
      color: FINISH_RACK_WALL,
      physical,
      restitution: 0.2,
      tags: ["finish-rack-part", ...tags],
    });

  const definitions: EntityDefinition[] = [
    rectangleDefinition({
      position,
      rotation,
      width,
      height,
      color: FINISH_RACK_BACKGROUND,
      physical: false,
      tags: ["finish-rack-part", "finish-rack-background"],
    }),
    finishZoneDefinition({
      position: worldPosition(position, rotation, [
        0,
        -height / 2 + wallThickness / 2,
      ]),
      rotation,
      width,
      height: wallThickness,
      color,
    }),
    wall([0, bottomWallY], layout.rackWidth, wallThickness, [
      "finish-rack-wall",
    ]),
    wall(
      [rackLeft + wallThickness / 2, gridCenterY],
      wallThickness,
      layout.gridHeight,
      ["finish-rack-wall"],
      false
    ),
    wall(
      [layout.rackWidth / 2 - wallThickness / 2, gridCenterY],
      wallThickness,
      layout.gridHeight,
      ["finish-rack-wall"],
      false
    ),
  ];

  if (finishBayCount > 1) {
    for (let index = 1; index < finishBayCount; index++) {
      definitions.push(
        wall(
          [
            rackLeft +
              index * (layout.gridWidth + wallThickness) +
              wallThickness / 2,
            gridCenterY,
          ],
          wallThickness,
          layout.gridHeight,
          ["finish-rack-divider"]
        )
      );
    }
  }

  return definitions;
};
