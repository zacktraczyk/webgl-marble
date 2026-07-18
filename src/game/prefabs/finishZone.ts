import type { EntityDefinition } from "../../engine/core/definition";
import type { Vec2 } from "../../engine/core/transform";
import type { Color } from "../../engine/core/color";
import type { FinishBayOptions } from "../race/finishGrid";
import { finishBayInnerSize, finishRackHeightFor } from "../race/finishGrid";
import { rectangleDefinition } from "./primitives/rectangle";

export const FINISH_RACK_HEIGHT = 135;

export const FINISH_LIGHT_COLOR: Color = [244 / 255, 244 / 255, 245 / 255, 1];
export const FINISH_DARK_COLOR: Color = [39 / 255, 39 / 255, 42 / 255, 1];
export const FINISH_RACK_BACKGROUND: Color = [
  9 / 255, 9 / 255, 11 / 255, 0.86,
];
export const FINISH_RACK_WALL: Color = [113 / 255, 113 / 255, 122 / 255, 1];
/** Dim overlay for X'd-out bays of already-eliminated teams. */
export const FINISH_RACK_DISABLED: Color = [
  24 / 255, 24 / 255, 27 / 255, 0.72,
];

export interface FinishRackRect {
  /** Center in rack-local coordinates. */
  position: Vec2;
  width: number;
  height: number;
}

export interface FinishLineCell extends FinishRackRect {
  light: boolean;
}

/** Checkerboard cells tiling a finish line strip, local to its center. */
export const finishLineCells = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): FinishLineCell[] => {
  const checkerSize = height / 2;
  const columnCount = Math.ceil(width / checkerSize);
  const cells: FinishLineCell[] = [];
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < columnCount; column++) {
      const left = -width / 2 + column * checkerSize;
      const cellWidth = Math.min(checkerSize, width / 2 - left);
      cells.push({
        position: [
          left + cellWidth / 2,
          -height / 2 + checkerSize * (row + 0.5),
        ],
        width: cellWidth,
        height: checkerSize,
        light: (row + column) % 2 === 0,
      });
    }
  }
  return cells;
};

export interface FinishRackFrame {
  finishLine: FinishRackRect;
  bottomWall: FinishRackRect;
  sideWalls: [FinishRackRect, FinishRackRect];
  dividers: FinishRackRect[];
  /**
   * Inner rects of the rightmost bays owned by already-eliminated teams,
   * rendered X'd out until the next era reset reflows the rack.
   */
  disabledBays: FinishRackRect[];
}

export type FinishRackFrameOptions = FinishBayOptions & {
  xBayCount?: number;
};

/** Rack-local rectangles shared by the runtime prefab and 2D previews. */
export const createFinishRackFrame = ({
  width,
  height,
  wallThickness,
  teamCount,
  xBayCount = 0,
}: FinishRackFrameOptions): FinishRackFrame => {
  const { gridWidth, gridHeight } = finishBayInnerSize({
    width,
    height,
    wallThickness,
    teamCount,
  });
  const rackLeft = -width / 2;
  const bayCenterY = -height / 2 + wallThickness + gridHeight / 2;
  const dividers: FinishRackRect[] = [];
  for (let index = 1; index < teamCount; index++) {
    dividers.push({
      position: [
        rackLeft + index * (gridWidth + wallThickness) + wallThickness / 2,
        bayCenterY,
      ],
      width: wallThickness,
      height: gridHeight,
    });
  }
  const disabledBays: FinishRackRect[] = [];
  for (let index = teamCount - xBayCount; index < teamCount; index++) {
    if (index < 0) continue;
    disabledBays.push({
      position: [
        rackLeft +
          wallThickness +
          index * (gridWidth + wallThickness) +
          gridWidth / 2,
        bayCenterY,
      ],
      width: gridWidth,
      height: gridHeight,
    });
  }
  return {
    disabledBays,
    finishLine: {
      position: [0, -height / 2 + wallThickness / 2],
      width,
      height: wallThickness,
    },
    bottomWall: {
      position: [
        0,
        -height / 2 + wallThickness + gridHeight + wallThickness / 2,
      ],
      width,
      height: wallThickness,
    },
    sideWalls: [
      {
        position: [rackLeft + wallThickness / 2, bayCenterY],
        width: wallThickness,
        height: gridHeight,
      },
      {
        position: [width / 2 - wallThickness / 2, bayCenterY],
        width: wallThickness,
        height: gridHeight,
      },
    ],
    dividers,
  };
};

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

  for (const cell of finishLineCells({ width, height })) {
    definition.render?.parts.push({
      primitive: { type: "rectangle", width: 1, height: 1 },
      color: cell.light ? FINISH_LIGHT_COLOR : FINISH_DARK_COLOR,
      localTransform: {
        position: cell.position,
        scale: [cell.width, cell.height],
      },
    });
  }

  return definition;
};

export const finishRackDefinitions = ({
  position,
  rotation = 0,
  width,
  height,
  wallThickness,
  teamCount,
  bayCount = teamCount,
  xBayCount = 0,
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
  /** Bays rendered — the era's team count; may exceed the active teams. */
  bayCount?: number;
  /** Rightmost bays X'd out for teams eliminated earlier in the era. */
  xBayCount?: number;
  marblesPerTeam?: number;
  maximumMarbleRadius?: number;
  minimumMarbleRadius?: number;
  marbleGap?: number;
  color: Color;
}): EntityDefinition[] => {
  // Validates the packed grid fits (throws otherwise) and supplies the rack
  // height whenever the caller has not already sized it.
  const packedHeight = finishRackHeightFor({
    width,
    wallThickness,
    bayCount,
    marblesPerTeam,
    marbleRadius: maximumMarbleRadius,
    minimumRadius: minimumMarbleRadius,
    gap: marbleGap,
  });
  const rackHeight = height ?? packedHeight;
  const frame = createFinishRackFrame({
    width,
    height: rackHeight,
    wallThickness,
    teamCount: bayCount,
    xBayCount,
  });
  const wall = (rect: FinishRackRect, tags: string[], physical = true) =>
    rectangleDefinition({
      position: worldPosition(position, rotation, rect.position),
      rotation,
      width: rect.width,
      height: rect.height,
      color: FINISH_RACK_WALL,
      physical,
      restitution: 0.2,
      tags: ["finish-rack-part", ...tags],
    });

  const disabledBayDefinitions = frame.disabledBays.flatMap((bay) => {
    const diagonal = Math.hypot(bay.width, bay.height);
    const angle = Math.atan2(bay.height, bay.width);
    const strokeThickness = wallThickness / 2;
    const bayCenter = worldPosition(position, rotation, bay.position);
    const stroke = (strokeAngle: number) =>
      rectangleDefinition({
        position: bayCenter,
        rotation: rotation + strokeAngle,
        width: diagonal,
        height: strokeThickness,
        color: FINISH_RACK_WALL,
        physical: false,
        tags: ["finish-rack-part", "finish-rack-x"],
      });
    return [
      rectangleDefinition({
        position: bayCenter,
        rotation,
        width: bay.width,
        height: bay.height,
        color: FINISH_RACK_DISABLED,
        physical: false,
        tags: ["finish-rack-part", "finish-rack-x"],
      }),
      stroke(angle),
      stroke(-angle),
    ];
  });

  return [
    rectangleDefinition({
      position,
      rotation,
      width,
      height: rackHeight,
      color: FINISH_RACK_BACKGROUND,
      physical: false,
      tags: ["finish-rack-part", "finish-rack-background"],
    }),
    finishZoneDefinition({
      position: worldPosition(position, rotation, frame.finishLine.position),
      rotation,
      width: frame.finishLine.width,
      height: frame.finishLine.height,
      color,
    }),
    wall(frame.bottomWall, ["finish-rack-wall"]),
    wall(frame.sideWalls[0], ["finish-rack-wall"], false),
    wall(frame.sideWalls[1], ["finish-rack-wall"], false),
    ...frame.dividers.map((divider) => wall(divider, ["finish-rack-divider"])),
    ...disabledBayDefinitions,
  ];
};
