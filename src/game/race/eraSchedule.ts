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
  /**
   * Marbles each team races with this leg: eliminated teams' marbles are
   * redistributed evenly to the survivors, rounded to whole grid rows.
   */
  marblesPerTeam: number;
  marbleRadius: number;
  rackHeight: number;
}

/**
 * Rack depth the race-wide marble radius aims for: small starting fields
 * scale their marbles up until even the widest (final) leg stacks at least
 * this many rows, so bays never flatten into a strip.
 */
const TARGET_FINISH_ROWS = 6;
/** Cap on that scaling, as a multiple of the base radius. */
const FINISH_MARBLE_SCALE_CAP = 3;

/**
 * Precomputes every leg's finish-rack layout for a race. When a team is
 * eliminated, its marbles are added evenly to the surviving teams, so each
 * leg's per-team count is `participantCount · startingMarbles / activeTeams`
 * — rounded to whole rows of the bay's fitted column count so every grid
 * fills exactly. Bays always split the rack among the active teams.
 *
 * The marble radius is constant across the race but scales with the
 * starting field: races with few marbles grow them (up to the cap) until
 * every leg's bays stack at least TARGET_FINISH_ROWS rows.
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

  // Race-wide radius: the largest any leg needs to reach the target rows at
  // its redistributed count, never below the base and never past the cap.
  const baseRadius = marbleRadius ?? 4.8;
  const gapSize = gap ?? 0.6;
  const raceRadius = Math.min(
    baseRadius * FINISH_MARBLE_SCALE_CAP,
    legs.reduce((radius, leg, legIndex) => {
      const activeTeams = participantCount - legIndex;
      const bayInnerWidth =
        (leg.width - leg.wallThickness * (activeTeams + 1)) / activeTeams;
      const idealMarbles = (participantCount * marblesPerTeam) / activeTeams;
      const neededDiameter =
        (TARGET_FINISH_ROWS * (bayInnerWidth + gapSize)) / idealMarbles -
        gapSize;
      return Math.max(radius, neededDiameter / 2);
    }, baseRadius)
  );

  return legs.map((leg, legIndex) => {
    const activeTeams = participantCount - legIndex;
    const shared: Omit<PackedFinishOptions, "marblesPerTeam"> = {
      width: leg.width,
      wallThickness: leg.wallThickness,
      bayCount: activeTeams,
      marbleRadius: raceRadius,
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
      marblesPerTeam: legMarbles,
      marbleRadius: layout.marbleRadius,
      rackHeight: layout.rackHeight,
    };
  });
};
