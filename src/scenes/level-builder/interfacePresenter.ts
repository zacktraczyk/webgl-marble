import type { BuilderUi } from "./elements";
import type { RaceSnapshot } from "./raceController";
import { SelectedTool, type RoundConfiguration } from "./types";

const key = (label: string) => `<kbd>${label}</kbd>`;

const toolHint = ({
  selectedTool,
  playbackActive,
}: {
  selectedTool: SelectedTool;
  playbackActive: boolean;
}) => {
  if (playbackActive) {
    return `Press ${key("R")}, or click the restart button, to continue editing`;
  }
  switch (selectedTool) {
    case SelectedTool.Pan:
      return `${key("Ctrl/⌘")} + wheel to zoom`;
    case SelectedTool.Wall:
      return `Hold ${key("Shift")} to lock the wall angle`;
    case SelectedTool.Bumper:
      return `Hold ${key("Alt")} to place without snapping`;
    case SelectedTool.SpawnPoint:
      return `Hold ${key("Alt")} to place without snapping`;
    case SelectedTool.Pointer:
      return `Hold ${key("Space")} and drag to pan`;
  }
};

export const updateBuilderInterface = ({
  ui,
  configuration,
  race,
  authoredObjects,
  selectedObjects,
  hoveredObject,
  wallThickness,
  selectedTool,
  toolLocked,
  canUndo,
  canRedo,
}: {
  ui: BuilderUi;
  configuration: RoundConfiguration;
  race: RaceSnapshot;
  authoredObjects: number;
  selectedObjects: readonly string[];
  hoveredObject: string | null;
  wallThickness: number;
  selectedTool: SelectedTool;
  toolLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
}) => {
  ui.teamCountOutput.value = `${configuration.teamCount}`;
  ui.marblesPerTeamOutput.value = `${configuration.marblesPerTeam}`;
  ui.releaseIntervalOutput.value = `${configuration.releaseIntervalMs} ms`;
  const playbackActive = race.phase !== "ready";
  ui.undoButton.disabled = playbackActive || !canUndo;
  ui.redoButton.disabled = playbackActive || !canRedo;
  ui.pointerButton.disabled = playbackActive;
  ui.wallButton.disabled = playbackActive;
  ui.bumperButton.disabled = playbackActive;
  ui.spawnPointButton.disabled = playbackActive;
  ui.toolLockButton.disabled =
    playbackActive ||
    (selectedTool !== SelectedTool.Wall &&
      selectedTool !== SelectedTool.Bumper &&
      selectedTool !== SelectedTool.SpawnPoint);
  ui.toolLockButton.dataset.active = `${toolLocked}`;
  ui.toolLockButton.ariaPressed = `${toolLocked}`;
  ui.toolLockButton.title = toolLocked
    ? "Create multiple objects (Q)"
    : "Create one object (Q)";
  ui.toolHintOutput.innerHTML = toolHint({
    selectedTool,
    playbackActive,
  });

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
      selectedObjects,
      hoveredObject,
      wallThickness,
      toolLocked,
    },
    null,
    2
  );
};
