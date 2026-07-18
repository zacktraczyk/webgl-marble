export type RacePhase = "ready" | "running" | "paused" | "complete";

/** Domain kind for a moving pusher wall (independent of editor tool UX). */
export type PusherKind = "slider" | "spinner" | "sweeper";

/** Layout for one leg's finish rack, precomputed for the whole race. */
export type FinishRackPlan = {
  /** Bays rendered — the era's team count; may exceed the active teams. */
  bayCount: number;
  /** Rightmost bays X'd out for teams eliminated earlier in the era. */
  xBayCount: number;
  rackHeight: number;
  /** Race-wide marble radius, scaled from the starting field size. */
  marbleRadius: number;
};

export type RoundConfiguration = {
  teamCount: number;
  marblesPerTeam: number;
  releaseIntervalMs: number;
  /** Set by the race player; the leg builder derives layout from teamCount. */
  finishPlan?: FinishRackPlan;
};
