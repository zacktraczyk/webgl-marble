import type { PackedFinishOptions } from "./finishGrid";
import { createPackedFinishLayout, roundToFinishGrid } from "./finishGrid";

export interface EraScheduleLeg {
  width: number;
  wallThickness: number;
}

export interface EraScheduleOptions {
  participantCount: number;
  /** Marbles each team starts the race with (leg counts grow from here). */
  marblesPerTeam: number;
  legs: readonly EraScheduleLeg[];
  marbleRadius?: number;
  minimumRadius?: number;
  gap?: number;
  maxRows?: number;
}

export interface LegFinishPlan {
  legIndex: number;
  /** Teams still racing this leg. */
  activeTeams: number;
  /** Bays rendered — always the active teams (bays reflow every leg). */
  bayCount: number;
  /** Kept for rendering compatibility; redistribution never leaves X bays. */
  xBayCount: number;
  /**
   * Marbles each team races with this leg: eliminated teams' marbles are
   * redistributed evenly to the survivors, rounded to whole grid rows.
   */
  marblesPerTeam: number;
  columns: number;
  rows: number;
  marbleRadius: number;
  rackHeight: number;
}

/**
 * Precomputes every leg's finish-rack layout for a race. When a team is
 * eliminated, its marbles are added evenly to the surviving teams, so each
 * leg's per-team count is `participantCount · startingMarbles / activeTeams`
 * — rounded to whole rows of the bay's fitted column count so every grid
 * fills exactly. Bays always split the rack among the active teams, and the
 * marble radius stays constant: wider bays simply hold more marbles.
 *
 * Deterministic: one team is eliminated per leg, so leg `i` races
 * `participantCount − i` teams.
 */
export const computeEraSchedule = ({
  participantCount,
  marblesPerTeam,
  legs,
  marbleRadius,
  minimumRadius,
  gap,
  maxRows,
}: EraScheduleOptions): LegFinishPlan[] => {
  if (!Number.isInteger(participantCount) || participantCount < 2) {
    throw new Error("A race needs at least two participants");
  }
  if (legs.length !== participantCount - 1) {
    throw new Error(
      `A ${participantCount}-team race needs ${participantCount - 1} legs, got ${legs.length}`
    );
  }

  return legs.map((leg, legIndex) => {
    const activeTeams = participantCount - legIndex;
    const shared: Omit<PackedFinishOptions, "marblesPerTeam"> = {
      width: leg.width,
      wallThickness: leg.wallThickness,
      bayCount: activeTeams,
      marbleRadius,
      minimumRadius,
      gap,
      maxRows,
    };
    const legMarbles = roundToFinishGrid({
      ...shared,
      idealMarbles: (participantCount * marblesPerTeam) / activeTeams,
    });
    const layout = createPackedFinishLayout({
      ...shared,
      marblesPerTeam: legMarbles,
    });
    return {
      legIndex,
      activeTeams,
      bayCount: activeTeams,
      xBayCount: 0,
      marblesPerTeam: legMarbles,
      columns: layout.columns,
      rows: layout.rows,
      marbleRadius: layout.marbleRadius,
      rackHeight: layout.rackHeight,
    };
  });
};
