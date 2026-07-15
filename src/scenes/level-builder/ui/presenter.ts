import type { LevelObjectData } from "../../../editor/levelDocument";
import { TEAM_COLORS, TEAM_NAMES } from "../../../game/race/staging";
import { pusherSpeedForMotion } from "../level/objects";
import type { RaceSnapshot } from "../race";
import { SelectedTool, type RoundConfiguration } from "../types";
import type { BuilderUi } from ".";

const key = (label: string) => `<kbd>${label}</kbd>`;

const setRaceOutcomeVisible = (element: HTMLElement, visible: boolean) => {
  if (visible) {
    delete element.dataset.exiting;
    element.hidden = false;
    return;
  }
  if (element.hidden || element.dataset.exiting === "true") {
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.hidden = true;
    return;
  }

  element.dataset.exiting = "true";
  const finishExit = () => {
    element.removeEventListener("animationend", handleAnimationEnd);
    if (element.dataset.exiting !== "true") {
      return;
    }
    element.hidden = true;
    delete element.dataset.exiting;
  };
  const handleAnimationEnd = (event: AnimationEvent) => {
    if (
      event.target === element &&
      event.animationName === "race-outcome-exit"
    ) {
      finishExit();
    }
  };
  element.addEventListener("animationend", handleAnimationEnd);
  window.setTimeout(finishExit, 500);
};

const toolHint = ({
  selectedTool,
  phase,
}: {
  selectedTool: SelectedTool;
  phase: RaceSnapshot["phase"];
}) => {
  if (phase === "complete") {
    return `Round frozen · press ${key("R")} to reset and keep editing`;
  }
  if (phase !== "ready") {
    return `Press ${key("R")}, or click the restart button, to continue editing`;
  }
  switch (selectedTool) {
    case SelectedTool.Pan:
      return `${key("Ctrl/⌘")} + wheel to zoom`;
    case SelectedTool.Wall:
      return `Click points to create connected walls`;
    case SelectedTool.SpawnPoint:
      return `Hold ${key("Alt")} to place without snapping`;
    case SelectedTool.Slider:
      return `Place a sliding wall · drag its blue path handle to aim and resize`;
    case SelectedTool.Spinner:
      return `Place a wall that spins around its center`;
    case SelectedTool.Sweeper:
      return `Place a wall that sweeps around its first endpoint`;
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
  selectedObject,
  hoveredObject,
  wallThickness,
  selectedTool,
  canUndo,
  canRedo,
}: {
  ui: BuilderUi;
  configuration: RoundConfiguration;
  race: RaceSnapshot;
  authoredObjects: number;
  selectedObjects: readonly string[];
  selectedObject: LevelObjectData | null;
  hoveredObject: string | null;
  wallThickness: number;
  selectedTool: SelectedTool;
  canUndo: boolean;
  canRedo: boolean;
}) => {
  ui.teamCountOutput.value = `${configuration.teamCount}`;
  ui.marblesPerTeamOutput.value = `${configuration.marblesPerTeam}`;
  ui.releaseIntervalOutput.value = `${configuration.releaseIntervalMs} ms`;
  const playbackActive = race.phase !== "ready";
  ui.undoButton.disabled = playbackActive || !canUndo;
  ui.redoButton.disabled = playbackActive || !canRedo;
  ui.resetButton.disabled = !playbackActive;
  ui.pointerButton.disabled = playbackActive;
  ui.wallButton.disabled = playbackActive;
  ui.spawnPointButton.disabled = playbackActive;
  ui.pusherMenuToggleButton.disabled = playbackActive;
  ui.sliderButton.disabled = playbackActive;
  ui.spinnerButton.disabled = playbackActive;
  ui.sweeperButton.disabled = playbackActive;
  ui.toolHintOutput.innerHTML = toolHint({
    selectedTool,
    phase: race.phase,
  });

  const selectedWall =
    selectedObject?.prefab === "wall" && !selectedObject.locked
      ? selectedObject
      : null;
  ui.objectInspector.hidden = !selectedWall || playbackActive;
  if (selectedWall) {
    const motion = selectedWall.motion;
    const motionType =
      motion?.type === "oscillate"
        ? "slide"
        : motion?.type === "rotate" && motion.pivot === "start"
          ? "sweep"
          : motion?.type === "rotate"
            ? "spin"
            : "none";
    ui.objectInspectorTitle.textContent =
      motionType === "none"
        ? "Wall"
        : motionType === "slide"
          ? "Slider"
          : motionType === "spin"
            ? "Spinner"
            : "Sweeper";
    ui.motionTypeSelect.value = motionType;
    ui.motionControls.hidden = !motion;
    ui.motionRangeRow.hidden = motion?.type !== "oscillate";
    if (motion?.type === "oscillate") {
      const range = Math.round(Math.hypot(...motion.vector));
      if (document.activeElement !== ui.motionRangeInput) {
        ui.motionRangeInput.value = `${range}`;
      }
      ui.motionRangeOutput.value = `${range}`;
    }
    if (motion) {
      const activeSpeed = pusherSpeedForMotion(motion);
      for (const button of ui.motionSpeedButtons) {
        button.dataset.active = `${button.dataset.speed === activeSpeed}`;
      }
      ui.motionReverseButton.ariaLabel =
        motion.direction === 1
          ? "Reverse motion direction"
          : "Restore forward motion direction";
      ui.motionReverseButton.title = ui.motionReverseButton.ariaLabel;
    }
  }

  const playButtonText =
    race.phase === "running"
      ? "Pause"
      : race.phase === "paused"
        ? "Resume"
        : race.phase === "complete"
          ? "Instant replay"
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

  const eliminatedTeamName =
    race.eliminatedTeamIndex === null
      ? null
      : TEAM_NAMES[race.eliminatedTeamIndex];
  if (eliminatedTeamName && race.eliminatedTeamIndex !== null) {
    const [red, green, blue] = TEAM_COLORS[race.eliminatedTeamIndex];
    ui.raceOutcomeSwatch.style.backgroundColor = `rgb(${Math.round(red * 255)} ${Math.round(green * 255)} ${Math.round(blue * 255)})`;
    ui.raceOutcomeLabel.textContent = `${eliminatedTeamName} marble eliminated`;
  }
  setRaceOutcomeVisible(
    ui.raceOutcome,
    race.phase === "complete" && Boolean(eliminatedTeamName)
  );

  ui.statusOutput.textContent = race.courseIssue
    ? race.courseIssue
    : race.phase === "ready"
      ? "Ready to race"
      : race.phase === "running" && race.queuedMarbles > 0
        ? `Releasing ${race.totalMarbles} marbles round-robin`
        : race.phase === "running"
          ? `${race.finishedMarbles} of ${race.totalMarbles} finished · ${race.remainingMarbles} on track`
          : race.phase === "paused"
            ? "Race paused"
            : eliminatedTeamName
              ? `${eliminatedTeamName} marble eliminated · time frozen`
              : "Race complete";

  ui.debugInfo.textContent = JSON.stringify(
    {
      phase: race.phase,
      teams: race.teamCount,
      totalMarbles: race.totalMarbles,
      queuedMarbles: race.queuedMarbles,
      releasedMarbles: race.releasedMarbles,
      finishedMarbles: race.finishedMarbles,
      remainingMarbles: race.remainingMarbles,
      eliminatedTeam: eliminatedTeamName,
      marbleRadius: race.marbleRadius,
      physicsActive: race.physicsActive,
      lostMarbles: race.lostMarbles,
      authoredObjects,
      selectedObjects,
      hoveredObject,
      wallThickness,
    },
    null,
    2
  );
};
