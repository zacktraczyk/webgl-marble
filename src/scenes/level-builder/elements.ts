import type { BuilderElements } from "./types";
import { requireElement } from "./utils";

export type BuilderUi = {
  toolLockButton: HTMLButtonElement;
  toolHintOutput: HTMLElement;
  panButton: HTMLButtonElement;
  pointerButton: HTMLButtonElement;
  wallButton: HTMLButtonElement;
  bumperButton: HTMLButtonElement;
  spawnPointButton: HTMLButtonElement;
  majorGridToggleButton: HTMLButtonElement;
  minorGridToggleButton: HTMLButtonElement;
  gridOverlay: HTMLElement;
  editorOverlayCanvas: HTMLCanvasElement;
  playButton: HTMLButtonElement;
  playButtonLabel: HTMLElement | null;
  playButtonIcons: SVGElement[];
  resetButton: HTMLButtonElement;
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
  statusOutput: HTMLElement;
  debugInfo: HTMLElement;
};

export const resolveBuilderUi = (selectors: BuilderElements): BuilderUi => {
  const playButton = requireElement<HTMLButtonElement>(selectors.play, "play");
  return {
    toolLockButton: requireElement(selectors.toolLock, "tool lock"),
    toolHintOutput: requireElement(selectors.toolHint, "tool hint"),
    panButton: requireElement(selectors.pan, "pan tool"),
    pointerButton: requireElement(selectors.pointer, "pointer tool"),
    wallButton: requireElement(selectors.wall, "wall tool"),
    bumperButton: requireElement(selectors.bumper, "bumper tool"),
    spawnPointButton: requireElement(selectors.spawnPoint, "spawn point tool"),
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
    statusOutput: requireElement(selectors.status, "status"),
    debugInfo: requireElement(selectors.debugInfo, "debug info"),
  };
};
