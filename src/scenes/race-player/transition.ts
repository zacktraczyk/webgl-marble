import type { LegInstance } from "./legInstance";

/**
 * Fraction of the incoming leg that must be on screen before its marbles start
 * releasing — the "marble transfer" hand-off point mid-scroll.
 */
export const NEXT_LEG_RELEASE_FRACTION = 2 / 3;

export type EliminationReason = "finished" | "skipped" | "timed-out";

export type LegWindow = {
  previous: LegInstance | null;
  current: LegInstance;
  next: LegInstance | null;
};

export type Transition = {
  released: boolean;
  oldLeg: LegInstance;
};
