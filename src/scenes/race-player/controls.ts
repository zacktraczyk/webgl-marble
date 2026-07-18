import type { RaceDocument } from "../../races/types";

/** Status line while a leg is actively racing. */
export const runningLegStatus = ({
  raceDocument,
  legIndex,
  activeTeamCount,
  marblesPerTeam,
  courseIssue,
}: {
  raceDocument: RaceDocument;
  legIndex: number;
  activeTeamCount: number;
  marblesPerTeam: number;
  courseIssue: string | null | undefined;
}) => {
  if (courseIssue) {
    return `${courseIssue}. This leg will time out or can be skipped.`;
  }
  const leg = raceDocument.legs[legIndex];
  return `Racing leg ${legIndex + 1}: ${leg.name} · ${activeTeamCount} teams · ${marblesPerTeam} marbles each`;
};

export const bindRacePlayerControls = ({
  signal,
  pauseButtons,
  restartButtons,
  skipContinueButtons,
  onPause,
  onRestart,
  onSkipContinue,
}: {
  signal: AbortSignal;
  pauseButtons: readonly HTMLButtonElement[];
  restartButtons: readonly HTMLButtonElement[];
  skipContinueButtons: readonly HTMLButtonElement[];
  onPause: () => void;
  onRestart: () => void;
  onSkipContinue: () => void;
}) => {
  for (const button of pauseButtons) {
    button.addEventListener("click", onPause, { signal });
  }
  for (const button of restartButtons) {
    button.addEventListener("click", onRestart, { signal });
  }
  for (const button of skipContinueButtons) {
    button.addEventListener("click", onSkipContinue, { signal });
  }
};
