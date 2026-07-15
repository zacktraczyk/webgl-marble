export type FinishRecord = {
  bayIndex: number;
  slotIndex: number;
  remainingMarbles: number;
  lastMarbleRemaining: boolean;
};

/** Tracks finished and lost marbles while preserving team-specific finish bays. */
export class RoundFinishTracker {
  private readonly finishCounts: number[];
  private readonly lostCounts: number[];
  private _finishedMarbles = 0;
  private _lostMarbles = 0;

  constructor(
    readonly teamCount: number,
    readonly marblesPerTeam: number
  ) {
    if (!Number.isInteger(teamCount) || teamCount < 1) {
      throw new Error("A round requires at least one team");
    }
    if (!Number.isInteger(marblesPerTeam) || marblesPerTeam < 1) {
      throw new Error("A team requires at least one marble");
    }
    this.finishCounts = Array.from({ length: teamCount }, () => 0);
    this.lostCounts = Array.from({ length: teamCount }, () => 0);
  }

  get totalMarbles() {
    return this.teamCount * this.marblesPerTeam;
  }

  get finishedMarbles() {
    return this._finishedMarbles;
  }

  get lostMarbles() {
    return this._lostMarbles;
  }

  get remainingMarbles() {
    return this.totalMarbles - this._finishedMarbles - this._lostMarbles;
  }

  get eliminatedTeamIndex() {
    if (this._lostMarbles > 0) {
      const teamIndex = this.lostCounts.findIndex((lost) => lost > 0);
      return teamIndex >= 0 ? teamIndex : null;
    }
    if (this.remainingMarbles !== 1) {
      return null;
    }
    const teamIndex = this.finishCounts.findIndex(
      (finished) => finished < this.marblesPerTeam
    );
    return teamIndex >= 0 ? teamIndex : null;
  }

  record(teamIndex: number): FinishRecord {
    this.assertKnownTeam(teamIndex);
    if (
      this.finishCounts[teamIndex] + this.lostCounts[teamIndex] >=
      this.marblesPerTeam
    ) {
      throw new Error(`Team ${teamIndex} has no remaining marbles`);
    }

    const slotIndex = this.finishCounts[teamIndex]++;
    this._finishedMarbles++;
    return {
      bayIndex: teamIndex,
      slotIndex,
      remainingMarbles: this.remainingMarbles,
      lastMarbleRemaining: this.remainingMarbles === 1,
    };
  }

  recordLost(teamIndex: number) {
    this.assertKnownTeam(teamIndex);
    if (
      this.finishCounts[teamIndex] + this.lostCounts[teamIndex] >=
      this.marblesPerTeam
    ) {
      throw new Error(`Team ${teamIndex} has no remaining marbles`);
    }
    this.lostCounts[teamIndex]++;
    this._lostMarbles++;
    return {
      teamIndex,
      remainingMarbles: this.remainingMarbles,
    };
  }

  private assertKnownTeam(teamIndex: number) {
    if (
      !Number.isInteger(teamIndex) ||
      teamIndex < 0 ||
      teamIndex >= this.teamCount
    ) {
      throw new Error(`Unknown team index: ${teamIndex}`);
    }
  }
}
