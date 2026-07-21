export type RaceProgressionSnapshot = {
  legIndex: number;
  activeParticipantIndices: readonly number[];
  eliminatedParticipantIndices: readonly number[];
  winnerIndex: number | null;
};

export type EliminationResult = RaceProgressionSnapshot & {
  eliminatedParticipantIndex: number;
};

/** Pure multi-leg elimination state, expressed entirely in stable indices. */
export class RaceProgression {
  private activeParticipantIndices: number[];
  private eliminatedParticipantIndices: number[] = [];
  private legIndex = 0;

  constructor(
    private readonly participantCount: number,
    legCount: number
  ) {
    if (!Number.isInteger(participantCount) || participantCount < 2) {
      throw new Error("A race requires at least two teams");
    }
    if (legCount !== participantCount - 1) {
      throw new Error(
        `A ${participantCount}-team race requires ${participantCount - 1} legs`
      );
    }
    this.activeParticipantIndices = this.createStartingField();
  }

  get snapshot(): RaceProgressionSnapshot {
    return {
      legIndex: this.legIndex,
      activeParticipantIndices: [...this.activeParticipantIndices],
      eliminatedParticipantIndices: [...this.eliminatedParticipantIndices],
      winnerIndex:
        this.activeParticipantIndices.length === 1
          ? this.activeParticipantIndices[0]
          : null,
    };
  }

  restart() {
    this.activeParticipantIndices = this.createStartingField();
    this.eliminatedParticipantIndices = [];
    this.legIndex = 0;
    return this.snapshot;
  }

  eliminate(stableParticipantIndex: number): EliminationResult {
    if (this.activeParticipantIndices.length <= 1) {
      throw new Error("The race already has a winner");
    }
    if (!this.activeParticipantIndices.includes(stableParticipantIndex)) {
      throw new Error(
        `Participant ${stableParticipantIndex} is not active in this leg`
      );
    }

    this.activeParticipantIndices = this.activeParticipantIndices.filter(
      (index) => index !== stableParticipantIndex
    );
    this.eliminatedParticipantIndices.push(stableParticipantIndex);
    if (this.activeParticipantIndices.length > 1) {
      this.legIndex++;
    }

    return {
      ...this.snapshot,
      eliminatedParticipantIndex: stableParticipantIndex,
    };
  }

  private createStartingField() {
    return Array.from({ length: this.participantCount }, (_, index) => index);
  }
}

/** Deterministic fallback for a skipped or timed-out leg. */
export const fallbackEliminationIndex = (
  activeParticipantIndices: readonly number[]
) => {
  const participantIndex = activeParticipantIndices.at(-1);
  if (participantIndex === undefined) {
    throw new Error("Cannot eliminate from an empty race field");
  }
  return participantIndex;
};
