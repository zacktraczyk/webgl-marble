import type { PackedFinishOptions } from "./finishGrid";
import { createPackedFinishLayout } from "./finishGrid";

export interface EraScheduleLeg {
  width: number;
  wallThickness: number;
}

export interface EraScheduleOptions {
  participantCount: number;
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
  /** Bays rendered — the era's team count, ≥ activeTeams. */
  bayCount: number;
  /** Eliminated bays, rendered X'd out at the far right. */
  xBayCount: number;
  columns: number;
  rows: number;
  marbleRadius: number;
  rackHeight: number;
}

/**
 * Precomputes every leg's finish-rack layout for a race. Bays span the full
 * rack width divided by the current era's team count; eliminated teams leave
 * X'd-out bays at the far right rather than reflowing every leg. An era only
 * resets when reflowing to the surviving team count visibly improves the
 * grid: strictly more columns per bay (the rack shrinks) or strictly larger
 * marbles (wide bays under the min-row floor scale marbles up to fill).
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

  const layoutFor = (leg: EraScheduleLeg, bayCount: number) =>
    createPackedFinishLayout({
      width: leg.width,
      wallThickness: leg.wallThickness,
      bayCount,
      marblesPerTeam,
      marbleRadius,
      minimumRadius,
      gap,
      maxRows,
    } satisfies PackedFinishOptions);

  const plans: LegFinishPlan[] = [];
  let eraTeamCount = participantCount;

  legs.forEach((leg, legIndex) => {
    const activeTeams = participantCount - legIndex;
    let layout = layoutFor(leg, eraTeamCount);
    if (activeTeams < eraTeamCount) {
      const reflow = layoutFor(leg, activeTeams);
      if (
        reflow.columns > layout.columns ||
        reflow.marbleRadius > layout.marbleRadius + 1e-6
      ) {
        eraTeamCount = activeTeams;
        layout = reflow;
      }
    }
    plans.push({
      legIndex,
      activeTeams,
      bayCount: eraTeamCount,
      xBayCount: eraTeamCount - activeTeams,
      columns: layout.columns,
      rows: layout.rows,
      marbleRadius: layout.marbleRadius,
      rackHeight: layout.rackHeight,
    });
  });

  return plans;
};
