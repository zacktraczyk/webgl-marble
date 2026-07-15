import type { Vec2 } from "../../engine/core/transform";
import type { StagingMarblePlacement } from "./staging";

export interface FinishGridOptions {
  position: Vec2;
  rotation?: number;
  width: number;
  height: number;
  wallThickness: number;
  teamCount: number;
  marblesPerTeam: number;
  maximumRadius?: number;
  minimumRadius?: number;
  gap?: number;
}

export interface FinishGridLayout {
  columns: number;
  rows: number;
  capacity: number;
  marbleRadius: number;
  columnGap: number;
  rowGap: number;
  gridWidth: number;
  gridHeight: number;
  rackWidth: number;
  rackHeight: number;
}

const assertPositiveFinite = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
};

const gridDimensions = (marblesPerTeam: number) => {
  const columns = Math.ceil(Math.sqrt(marblesPerTeam));
  const rows = Math.ceil(marblesPerTeam / columns);
  return { columns, rows };
};

/** Sizes every team grid against the exact inner edges of its finish bay. */
export const createFinishGridLayout = ({
  width,
  height,
  wallThickness,
  teamCount,
  marblesPerTeam,
  maximumRadius = 4.8,
  minimumRadius = 1.2,
  gap = 0.6,
}: FinishGridOptions): FinishGridLayout => {
  assertPositiveFinite(width, "Finish rack width");
  assertPositiveFinite(height, "Finish rack height");
  assertPositiveFinite(wallThickness, "Finish wall thickness");
  assertPositiveFinite(maximumRadius, "Maximum marble radius");
  assertPositiveFinite(minimumRadius, "Minimum marble radius");
  if (!Number.isInteger(teamCount) || teamCount < 1) {
    throw new Error("Team count must be a positive integer");
  }
  if (!Number.isInteger(marblesPerTeam) || marblesPerTeam < 1) {
    throw new Error("Marbles per team must be a positive integer");
  }
  if (!Number.isFinite(gap) || gap < 0) {
    throw new Error("Finish marble gap must be finite and non-negative");
  }
  if (minimumRadius > maximumRadius) {
    throw new Error("Minimum marble radius cannot exceed the maximum");
  }

  const { columns, rows } = gridDimensions(marblesPerTeam);
  const availableGridWidth =
    (width - wallThickness * (teamCount + 1)) / teamCount;
  const availableGridHeight = height - wallThickness * 2;
  const diameter = Math.min(
    maximumRadius * 2,
    (availableGridWidth - gap * Math.max(0, columns - 1)) / columns,
    (availableGridHeight - gap * Math.max(0, rows - 1)) / rows
  );

  if (!Number.isFinite(diameter) || diameter < minimumRadius * 2) {
    throw new Error(
      `The finish rack cannot fit ${marblesPerTeam} marbles for each of ${teamCount} teams`
    );
  }

  const marbleRadius = diameter / 2;
  const columnGap =
    columns > 1 ? (availableGridWidth - columns * diameter) / (columns - 1) : 0;
  const rowGap =
    rows > 1 ? (availableGridHeight - rows * diameter) / (rows - 1) : 0;

  return {
    columns,
    rows,
    capacity: columns * rows,
    marbleRadius,
    columnGap,
    rowGap,
    gridWidth: availableGridWidth,
    gridHeight: availableGridHeight,
    rackWidth: width,
    rackHeight: height,
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

export const createFinishGridPlacements = (
  options: FinishGridOptions
): StagingMarblePlacement[] => {
  const layout = createFinishGridLayout(options);
  const rotation = options.rotation ?? 0;
  const diameter = layout.marbleRadius * 2;
  const rackLeft = -layout.rackWidth / 2;
  const gridTop = -options.height / 2 + options.wallThickness;
  const placements: StagingMarblePlacement[] = [];

  for (let teamIndex = 0; teamIndex < options.teamCount; teamIndex++) {
    const gridLeft =
      rackLeft +
      options.wallThickness +
      teamIndex * (layout.gridWidth + options.wallThickness);
    for (let slotIndex = 0; slotIndex < options.marblesPerTeam; slotIndex++) {
      const column = slotIndex % layout.columns;
      const row = layout.rows - 1 - Math.floor(slotIndex / layout.columns);
      placements.push({
        teamIndex,
        slotIndex,
        position: worldPosition(options.position, rotation, [
          gridLeft +
            layout.marbleRadius +
            column * (diameter + layout.columnGap),
          gridTop + layout.marbleRadius + row * (diameter + layout.rowGap),
        ]),
      });
    }
  }

  return placements;
};
