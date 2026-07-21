export type FinishRecord = {
  bayIndex: number;
  slotIndex: number;
};

/**
 * Tracks finished marbles. Finish bays are not pre-assigned: a team claims
 * the leftmost unclaimed bay when its first marble finishes, so bay order
 * mirrors the order teams reached the finish. X'd-out bays (eliminated in an
 * earlier leg) sit at the far right, beyond every claimable index.
 */
export class RoundFinishTracker {
  private readonly finishCounts: number[];
  private readonly bayByTeam: (number | null)[];
  private nextBay = 0;
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
    this.bayByTeam = Array.from({ length: teamCount }, () => null);
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
    let remainingTeamIndex: number | null = null;
    for (let teamIndex = 0; teamIndex < this.teamCount; teamIndex++) {
      if (this.finishCounts[teamIndex] >= this.marblesPerTeam) {
        continue;
      }
      if (remainingTeamIndex !== null) {
        return null;
      }
      remainingTeamIndex = teamIndex;
    }
    return remainingTeamIndex;
  }

  record(teamIndex: number): FinishRecord {
    this.assertKnownTeam(teamIndex);
    if (this.finishCounts[teamIndex] >= this.marblesPerTeam) {
      throw new Error(`Team ${teamIndex} has no remaining marbles`);
    }

    let bayIndex = this.bayByTeam[teamIndex];
    if (bayIndex === null) {
      bayIndex = this.nextBay++;
      this.bayByTeam[teamIndex] = bayIndex;
    }
    const slotIndex = this.finishCounts[teamIndex]++;
    this._finishedMarbles++;
    return {
      bayIndex,
      slotIndex,
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
