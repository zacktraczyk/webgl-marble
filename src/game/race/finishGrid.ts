import type { Vec2 } from "../../engine/core/transform";

const assertPositiveFinite = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
};

export interface FinishBayOptions {
  width: number;
  height: number;
  wallThickness: number;
  teamCount: number;
}

export interface FinishBayInnerSize {
  gridWidth: number;
  gridHeight: number;
}

/** Inner size of each team bay once the rack walls are carved out. */
export const finishBayInnerSize = ({
  width,
  height,
  wallThickness,
  teamCount,
}: FinishBayOptions): FinishBayInnerSize => {
  assertPositiveFinite(width, "Finish rack width");
  assertPositiveFinite(height, "Finish rack height");
  assertPositiveFinite(wallThickness, "Finish wall thickness");
  if (!Number.isInteger(teamCount) || teamCount < 1) {
    throw new Error("Team count must be a positive integer");
  }
  const gridWidth = (width - wallThickness * (teamCount + 1)) / teamCount;
  const gridHeight = height - wallThickness * 2;
  if (gridWidth <= 0 || gridHeight <= 0) {
    throw new Error(
      `A ${width}×${height} finish rack cannot fit ${teamCount} team bays`
    );
  }
  return { gridWidth, gridHeight };
};

/**
 * Row cap for packed finish grids. When a bay is so narrow that a perfect
 * grid would stack deeper than this, the layout falls back to shrinking the
 * marble radius instead of growing the rack without bound.
 */
export const MAX_FINISH_ROWS = 24;
/**
 * Row floor. Wide bays would otherwise flatten the grid into a strip a
 * marble or two tall; instead the column count is capped so at least this
 * many rows remain, and the marble radius grows uniformly to fill the width.
 */
export const MIN_FINISH_ROWS = 5;
/** Cap on fill-the-bay radius growth, as a multiple of the base radius. */
export const MAX_FINISH_MARBLE_SCALE = 3;

export interface PackedFinishOptions {
  width: number;
  wallThickness: number;
  bayCount: number;
  marblesPerTeam: number;
  marbleRadius?: number;
  minimumRadius?: number;
  gap?: number;
  maxRows?: number;
}

export interface PackedFinishLayout {
  columns: number;
  rows: number;
  marbleRadius: number;
  /** Vertical center-to-center spacing between rows (tight packing). */
  pitch: number;
  /**
   * Horizontal center-to-center spacing between columns, edge-to-edge (the
   * first and last columns touch the bay walls). Exact fills make this equal
   * to `pitch`; crunched grids make it smaller (columns overlap slightly).
   * Loose spacing (larger than `pitch`) only survives in degenerate configs
   * where no divisor can span the bay.
   */
  columnPitch: number;
  bayInnerWidth: number;
  gridHeight: number;
  rackHeight: number;
  /** True when the radius had to shrink below the requested size to fit. */
  shrunk: boolean;
}

/** Largest divisor of `value` that is at most `limit`, or null if none fit. */
export const largestFittingDivisor = (
  value: number,
  limit: number
): number | null => {
  for (let candidate = Math.min(Math.floor(limit), value); candidate >= 1; candidate--) {
    if (value % candidate === 0) {
      return candidate;
    }
  }
  return null;
};

const smallestDivisorAtLeast = (value: number, minimum: number): number => {
  for (let candidate = Math.max(1, Math.ceil(minimum)); candidate < value; candidate++) {
    if (value % candidate === 0) {
      return candidate;
    }
  }
  return value;
};

/**
 * Sizes a perfect-fill finish grid: a constant marble radius, tight packing,
 * and a column count that divides the team's marbles exactly so a finished
 * team's bay has zero blank slots. The rack height is an output — it grows
 * with the row count instead of squeezing marbles into a fixed frame.
 */
export const createPackedFinishLayout = ({
  width,
  wallThickness,
  bayCount,
  marblesPerTeam,
  marbleRadius = 4.8,
  minimumRadius = 1.2,
  gap = 0.6,
  maxRows = MAX_FINISH_ROWS,
}: PackedFinishOptions): PackedFinishLayout => {
  assertPositiveFinite(width, "Finish rack width");
  assertPositiveFinite(wallThickness, "Finish wall thickness");
  assertPositiveFinite(marbleRadius, "Finish marble radius");
  assertPositiveFinite(minimumRadius, "Minimum marble radius");
  if (!Number.isInteger(bayCount) || bayCount < 1) {
    throw new Error("Bay count must be a positive integer");
  }
  if (!Number.isInteger(marblesPerTeam) || marblesPerTeam < 1) {
    throw new Error("Marbles per team must be a positive integer");
  }
  if (!Number.isFinite(gap) || gap < 0) {
    throw new Error("Finish marble gap must be finite and non-negative");
  }
  if (!Number.isInteger(maxRows) || maxRows < 1) {
    throw new Error("Finish max rows must be a positive integer");
  }

  const bayInnerWidth = (width - wallThickness * (bayCount + 1)) / bayCount;
  if (bayInnerWidth <= 0) {
    throw new Error(`A ${width}-wide finish rack cannot fit ${bayCount} bays`);
  }

  let radius = marbleRadius;
  let columns = largestFittingDivisor(
    marblesPerTeam,
    (bayInnerWidth + gap) / (radius * 2 + gap)
  );

  let shrunk = false;
  if (columns === null || marblesPerTeam / columns > maxRows) {
    // The bay is too narrow for a full-radius perfect grid within the row
    // cap. Use the fewest columns that respect the cap (preserving as much
    // radius as possible) and shrink marbles to fit that column count.
    columns = smallestDivisorAtLeast(
      marblesPerTeam,
      marblesPerTeam / maxRows
    );
    const diameter = (bayInnerWidth - gap * (columns - 1)) / columns;
    if (!Number.isFinite(diameter) || diameter < minimumRadius * 2) {
      throw new Error(
        `The finish rack cannot fit ${marblesPerTeam} marbles for each of ${bayCount} bays`
      );
    }
    const fitted = Math.min(radius, diameter / 2);
    shrunk = fitted < radius;
    radius = fitted;
  } else {
    // Wide side: never leave loose spacing. Cap columns so the grid keeps at
    // least MIN_FINISH_ROWS rows, then grow the radius so the columns span
    // the bay exactly. If the growth cap binds before the bay is spanned,
    // crunch instead: step up to the next divisor and let columns overlap.
    if (marblesPerTeam / columns < MIN_FINISH_ROWS) {
      const cappedColumns = largestFittingDivisor(
        marblesPerTeam,
        marblesPerTeam / MIN_FINISH_ROWS
      );
      if (cappedColumns !== null) {
        columns = cappedColumns;
      }
    }
    const radiusCap = marbleRadius * MAX_FINISH_MARBLE_SCALE;
    const fillDiameter = (bayInnerWidth + gap) / columns - gap;
    if (fillDiameter / 2 <= radiusCap) {
      radius = fillDiameter / 2;
    } else {
      radius = radiusCap;
      const diameter = radius * 2;
      let crunched: number | null = null;
      for (let candidate = columns + 1; candidate <= marblesPerTeam; candidate++) {
        if (marblesPerTeam % candidate !== 0) {
          continue;
        }
        if ((bayInnerWidth - diameter) / (candidate - 1) <= diameter + gap) {
          crunched = candidate;
          break;
        }
      }
      // No divisor spans the bay even fully crunched (tiny fields in huge
      // bays): fall back to a single spread row — the least-loose option.
      columns = crunched ?? marblesPerTeam;
    }
  }

  const pitch = radius * 2 + gap;
  const rows = marblesPerTeam / columns;
  const gridHeight = rows * pitch - gap;
  const columnPitch =
    columns > 1
      ? radius * 2 + (bayInnerWidth - columns * radius * 2) / (columns - 1)
      : 0;

  return {
    columns,
    rows,
    marbleRadius: radius,
    pitch,
    columnPitch,
    bayInnerWidth,
    gridHeight,
    rackHeight: gridHeight + wallThickness * 2,
    shrunk,
  };
};

/**
 * The rack height a packed layout needs. Level placement, leg stacking, and
 * the builders all derive height from here so they always agree.
 */
export const finishRackHeightFor = (options: PackedFinishOptions): number =>
  createPackedFinishLayout(options).rackHeight;

export interface FinishMarblePlacement {
  bayIndex: number;
  slotIndex: number;
  position: Vec2;
}

export interface PackedFinishPlacementOptions extends PackedFinishOptions {
  position: Vec2;
  rotation?: number;
}

/**
 * World positions for every finish slot, in every bay (bays are claimed
 * dynamically, so disabled bays simply never receive marbles). Slots fill
 * row-major from the bottom row up, left to right — a liquid fill.
 */
export const createPackedFinishPlacements = (
  options: PackedFinishPlacementOptions
): FinishMarblePlacement[] => {
  const layout = createPackedFinishLayout(options);
  const rotation = options.rotation ?? 0;
  const { wallThickness, bayCount, marblesPerTeam } = options;
  const rackLeft = -options.width / 2;
  const gridBottom = layout.rackHeight / 2 - wallThickness;
  const placements: FinishMarblePlacement[] = [];

  for (let bayIndex = 0; bayIndex < bayCount; bayIndex++) {
    const bayLeft =
      rackLeft +
      wallThickness +
      bayIndex * (layout.bayInnerWidth + wallThickness);
    // Columns spread edge-to-edge; a single column centers in its bay.
    const firstColumnX =
      layout.columns > 1
        ? bayLeft + layout.marbleRadius
        : bayLeft + layout.bayInnerWidth / 2;
    for (let slotIndex = 0; slotIndex < marblesPerTeam; slotIndex++) {
      const column = slotIndex % layout.columns;
      const row = Math.floor(slotIndex / layout.columns);
      placements.push({
        bayIndex,
        slotIndex,
        position: worldPosition(options.position, rotation, [
          firstColumnX + column * layout.columnPitch,
          gridBottom - layout.marbleRadius - row * layout.pitch,
        ]),
      });
    }
  }

  return placements;
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
