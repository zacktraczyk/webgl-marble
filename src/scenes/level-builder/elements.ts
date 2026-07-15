import type { BuilderElements } from "./types";
import { requireElement } from "./utils";

export type BuilderUi = {
  root: HTMLElement;
  toolbar: HTMLElement;
  raceControls: HTMLElement;
  toolHintOutput: HTMLElement;
  panButton: HTMLButtonElement;
  pointerButton: HTMLButtonElement;
  wallButton: HTMLButtonElement;
  spawnPointButton: HTMLButtonElement;
  pusherMenuToggleButton: HTMLButtonElement;
  pusherLibrary: HTMLElement;
  sliderButton: HTMLButtonElement;
  spinnerButton: HTMLButtonElement;
  sweeperButton: HTMLButtonElement;
  gridSnapToggleButton: HTMLButtonElement;
  majorGridToggleButton: HTMLButtonElement;
  minorGridToggleButton: HTMLButtonElement;
  gridOverlay: HTMLElement;
  editorOverlayCanvas: HTMLCanvasElement;
  playButton: HTMLButtonElement;
  playButtonLabel: HTMLElement | null;
  playButtonIcons: SVGElement[];
  resetButton: HTMLButtonElement;
  raceOutcome: HTMLElement;
  raceOutcomeSwatch: HTMLElement;
  raceOutcomeLabel: HTMLElement;
  zoomInButton: HTMLButtonElement;
  zoomOutButton: HTMLButtonElement;
  zoomResetButton: HTMLButtonElement;
  zoomLevelOutput: HTMLOutputElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  teamCountInput: HTMLInputElement;
  teamCountOutput: HTMLOutputElement;
  marblesPerTeamInput: HTMLInputElement;
  marblesPerTeamOutput: HTMLOutputElement;
  releaseIntervalInput: HTMLInputElement;
  releaseIntervalOutput: HTMLOutputElement;
  courseWidthInput: HTMLInputElement;
  courseHeightInput: HTMLInputElement;
  wallThicknessInput: HTMLInputElement;
  objectInspector: HTMLElement;
  objectInspectorTitle: HTMLElement;
  motionTypeSelect: HTMLSelectElement;
  motionControls: HTMLElement;
  motionRangeRow: HTMLElement;
  motionRangeInput: HTMLInputElement;
  motionRangeOutput: HTMLOutputElement;
  motionReverseButton: HTMLButtonElement;
  motionSpeedButtons: HTMLButtonElement[];
  statusOutput: HTMLElement;
  debugInfo: HTMLElement;
};

export const resolveBuilderUi = (selectors: BuilderElements): BuilderUi => {
  const playButton = requireElement<HTMLButtonElement>(selectors.play, "play");
  const raceOutcome = requireElement(selectors.raceOutcome, "race outcome");
  return {
    root: requireElement(selectors.root, "level builder"),
    toolbar: requireElement(selectors.toolbar, "builder toolbar"),
    raceControls: requireElement(selectors.raceControls, "race controls"),
    toolHintOutput: requireElement(selectors.toolHint, "tool hint"),
    panButton: requireElement(selectors.pan, "pan tool"),
    pointerButton: requireElement(selectors.pointer, "pointer tool"),
    wallButton: requireElement(selectors.wall, "wall tool"),
    spawnPointButton: requireElement(selectors.spawnPoint, "spawn point tool"),
    pusherMenuToggleButton: requireElement(
      selectors.pusherMenuToggle,
      "pusher library toggle"
    ),
    pusherLibrary: requireElement(selectors.pusherLibrary, "pusher library"),
    sliderButton: requireElement(selectors.slider, "slider pusher"),
    spinnerButton: requireElement(selectors.spinner, "spinner pusher"),
    sweeperButton: requireElement(selectors.sweeper, "sweeper pusher"),
    gridSnapToggleButton: requireElement(
      selectors.gridSnapToggle,
      "grid snap toggle"
    ),
    majorGridToggleButton: requireElement(
      selectors.majorGridToggle,
      "major grid toggle"
    ),
    minorGridToggleButton: requireElement(
      selectors.minorGridToggle,
      "minor grid toggle"
    ),
    gridOverlay: requireElement(selectors.gridOverlay, "grid overlay"),
    editorOverlayCanvas: requireElement(
      selectors.editorOverlay,
      "editor overlay"
    ),
    playButton,
    playButtonLabel: playButton.querySelector("[data-race-button-label]"),
    playButtonIcons: Array.from(
      playButton.querySelectorAll<SVGElement>("[data-race-icon]")
    ),
    resetButton: requireElement(selectors.reset, "reset"),
    raceOutcome,
    raceOutcomeSwatch: requireElement(
      raceOutcome.querySelector("[data-race-outcome-swatch]"),
      "race outcome swatch"
    ),
    raceOutcomeLabel: requireElement(
      raceOutcome.querySelector("[data-race-outcome-label]"),
      "race outcome label"
    ),
    zoomInButton: requireElement(selectors.zoomIn, "zoom in"),
    zoomOutButton: requireElement(selectors.zoomOut, "zoom out"),
    zoomResetButton: requireElement(selectors.zoomReset, "reset zoom"),
    zoomLevelOutput: requireElement(selectors.zoomLevel, "zoom level"),
    undoButton: requireElement(selectors.undo, "undo"),
    redoButton: requireElement(selectors.redo, "redo"),
    teamCountInput: requireElement(selectors.teamCount, "team count"),
    teamCountOutput: requireElement(
      selectors.teamCountOutput,
      "team count output"
    ),
    marblesPerTeamInput: requireElement(
      selectors.marblesPerTeam,
      "marbles per team"
    ),
    marblesPerTeamOutput: requireElement(
      selectors.marblesPerTeamOutput,
      "marbles per team output"
    ),
    releaseIntervalInput: requireElement(
      selectors.releaseInterval,
      "release interval"
    ),
    releaseIntervalOutput: requireElement(
      selectors.releaseIntervalOutput,
      "release interval output"
    ),
    courseWidthInput: requireElement(selectors.courseWidth, "course width"),
    courseHeightInput: requireElement(selectors.courseHeight, "course height"),
    wallThicknessInput: requireElement(
      selectors.wallThickness,
      "wall thickness"
    ),
    objectInspector: requireElement(
      selectors.objectInspector,
      "object inspector"
    ),
    objectInspectorTitle: requireElement(
      selectors.objectInspectorTitle,
      "object inspector title"
    ),
    motionTypeSelect: requireElement(selectors.motionType, "motion type"),
    motionControls: requireElement(selectors.motionControls, "motion controls"),
    motionRangeRow: requireElement(
      selectors.motionRangeRow,
      "motion range row"
    ),
    motionRangeInput: requireElement(selectors.motionRange, "motion range"),
    motionRangeOutput: requireElement(
      selectors.motionRangeOutput,
      "motion range output"
    ),
    motionReverseButton: requireElement(
      selectors.motionReverse,
      "reverse motion"
    ),
    motionSpeedButtons: [
      requireElement<HTMLButtonElement>(
        selectors.motionSpeedSlow,
        "slow motion"
      ),
      requireElement<HTMLButtonElement>(
        selectors.motionSpeedMedium,
        "medium motion"
      ),
      requireElement<HTMLButtonElement>(
        selectors.motionSpeedFast,
        "fast motion"
      ),
    ],
    statusOutput: requireElement(selectors.status, "status"),
    debugInfo: requireElement(selectors.debugInfo, "debug info"),
  };
};
