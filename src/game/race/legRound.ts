import type { RoundConfiguration } from "./types";
import {
  MAX_MARBLE_RADIUS,
  MIN_MARBLE_RADIUS,
  STAGING_MARBLE_GAP,
} from "../level/constants";
import {
  computeEraSchedule,
  type EraScheduleLeg,
  type LegFinishPlan,
} from "./eraSchedule";

export type LegRoundRaceInput = {
  participantCount: number;
  marblesPerTeam: number;
  releaseIntervalMs: number;
  legs: readonly EraScheduleLeg[];
};

/** Full era schedule when the race has the expected leg count; otherwise null. */
export const resolveLegFinishPlan = (
  race: LegRoundRaceInput,
  legIndex: number
): LegFinishPlan | null => {
  if (legIndex < 0 || race.legs.length !== race.participantCount - 1) {
    return null;
  }
  try {
    const schedule = computeEraSchedule({
      participantCount: race.participantCount,
      marblesPerTeam: race.marblesPerTeam,
      legs: race.legs,
      marbleRadius: MAX_MARBLE_RADIUS,
      minimumRadius: MIN_MARBLE_RADIUS,
      gap: STAGING_MARBLE_GAP,
    });
    return schedule[legIndex] ?? null;
  } catch {
    return null;
  }
};

/**
 * Round config for one leg: era finish plan when available, otherwise an
 * even-split approximation for incomplete races.
 */
export const createLegRoundConfiguration = (
  race: LegRoundRaceInput,
  legIndex: number,
  finishPlan: LegFinishPlan | null = resolveLegFinishPlan(race, legIndex)
): RoundConfiguration => {
  if (finishPlan) {
    return roundConfigurationFromFinishPlan(finishPlan, race.releaseIntervalMs);
  }

  const teamCount = Math.max(2, race.participantCount - Math.max(legIndex, 0));
  return {
    teamCount,
    marblesPerTeam: Math.max(
      1,
      Math.round((race.participantCount * race.marblesPerTeam) / teamCount)
    ),
    releaseIntervalMs: race.releaseIntervalMs,
  };
};

export const roundConfigurationFromFinishPlan = (
  plan: LegFinishPlan,
  releaseIntervalMs: number
): RoundConfiguration => ({
  teamCount: plan.activeTeams,
  marblesPerTeam: plan.marblesPerTeam,
  releaseIntervalMs,
  finishPlan: {
    rackHeight: plan.rackHeight,
    marbleRadius: plan.marbleRadius,
  },
});
