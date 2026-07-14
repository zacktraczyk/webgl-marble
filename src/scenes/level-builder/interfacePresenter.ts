import type { BuilderUi } from "./elements";
import type { RaceSnapshot } from "./raceController";
import type { RoundConfiguration } from "./types";

export const updateBuilderInterface = ({
  ui,
  configuration,
  race,
  authoredObjects,
  selectedObject,
  hoveredObject,
}: {
  ui: BuilderUi;
  configuration: RoundConfiguration;
  race: RaceSnapshot;
  authoredObjects: number;
  selectedObject: string | null;
  hoveredObject: string | null;
}) => {
  ui.teamCountOutput.value = `${configuration.teamCount}`;
  ui.marblesPerTeamOutput.value = `${configuration.marblesPerTeam}`;
  ui.releaseIntervalOutput.value = `${configuration.releaseIntervalMs} ms`;

  const playButtonText =
    race.phase === "running"
      ? "Pause"
      : race.phase === "paused"
        ? "Resume"
        : race.phase === "complete"
          ? "Run again"
          : "Run race";
  const playButtonIcon =
    race.phase === "running"
      ? "pause"
      : race.phase === "complete"
        ? "replay"
        : "play";

  ui.playButton.disabled = Boolean(race.courseIssue);
  ui.playButton.dataset.previewing = `${race.phase !== "ready"}`;
  ui.playButton.ariaLabel = race.courseIssue ?? playButtonText;
  ui.playButton.title = race.courseIssue ?? playButtonText;
  if (ui.playButtonLabel) {
    ui.playButtonLabel.textContent = playButtonText;
  }
  for (const icon of ui.playButtonIcons) {
    icon.classList.toggle("hidden", icon.dataset.raceIcon !== playButtonIcon);
  }

  ui.statusOutput.textContent = race.courseIssue
    ? race.courseIssue
    : race.phase === "ready"
      ? "Ready to race"
      : race.phase === "running" && race.stagedMarbles > 0
        ? `Releasing ${race.totalMarbles} marbles round-robin`
        : race.phase === "running"
          ? "All marbles released"
          : race.phase === "paused"
            ? "Race paused"
            : "Race complete";

  ui.debugInfo.textContent = JSON.stringify(
    {
      phase: race.phase,
      teams: race.teamCount,
      totalMarbles: race.totalMarbles,
      stagedMarbles: race.stagedMarbles,
      releasedMarbles: race.releasedMarbles,
      finishedMarbles: race.finishedMarbles,
      marbleRadius: race.marbleRadius,
      stagingPhysicsActive: race.stagingPhysicsActive,
      lostMarbles: race.lostMarbles,
      authoredObjects,
      selectedObject,
      hoveredObject,
    },
    null,
    2
  );
};
