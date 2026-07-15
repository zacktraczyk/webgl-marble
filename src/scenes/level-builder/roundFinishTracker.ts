export type FinishRecord = {
  bayIndex: number;
  slotIndex: number;
  remainingMarbles: number;
  lastMarbleRemaining: boolean;
};

/** Tracks completed marbles in fixed team bays and identifies the final marble. */
export class RoundFinishTracker {
  private readonly finishCounts: number[];
  private _finishedMarbles = 0;

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
  }

  get totalMarbles() {
    return this.teamCount * this.marblesPerTeam;
  }

  get finishedMarbles() {
    return this._finishedMarbles;
  }

  get remainingMarbles() {
    return this.totalMarbles - this._finishedMarbles;
  }

  get eliminatedTeamIndex() {
    if (this.remainingMarbles !== 1) {
      return null;
    }
    const teamIndex = this.finishCounts.findIndex(
      (finished) => finished < this.marblesPerTeam
    );
    return teamIndex >= 0 ? teamIndex : null;
  }

  record(teamIndex: number): FinishRecord {
    if (
      !Number.isInteger(teamIndex) ||
      teamIndex < 0 ||
      teamIndex >= this.teamCount
    ) {
      throw new Error(`Unknown team index: ${teamIndex}`);
    }
    if (this.finishCounts[teamIndex] >= this.marblesPerTeam) {
      throw new Error(`Team ${teamIndex} has already finished every marble`);
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
}
