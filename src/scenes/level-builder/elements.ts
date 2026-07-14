import type { BuilderElements } from "./types";
import { requireElement } from "./utils";

export type BuilderUi = {
  panButton: HTMLButtonElement;
  pointerButton: HTMLButtonElement;
  wallButton: HTMLButtonElement;
  bumperButton: HTMLButtonElement;
  spawnPointButton: HTMLButtonElement;
  gridToggleButton: HTMLButtonElement;
  gridOverlay: HTMLElement;
  editorOverlayCanvas: HTMLCanvasElement;
  playButton: HTMLButtonElement;
  playButtonLabel: HTMLElement | null;
  playButtonIcons: SVGElement[];
  resetButton: HTMLButtonElement;
  teamCountInput: HTMLInputElement;
  teamCountOutput: HTMLOutputElement;
  marblesPerTeamInput: HTMLInputElement;
  marblesPerTeamOutput: HTMLOutputElement;
  releaseIntervalInput: HTMLInputElement;
  releaseIntervalOutput: HTMLOutputElement;
  courseWidthInput: HTMLInputElement;
  courseHeightInput: HTMLInputElement;
  statusOutput: HTMLElement;
  debugInfo: HTMLElement;
};

export const resolveBuilderUi = (selectors: BuilderElements): BuilderUi => {
  const playButton = requireElement<HTMLButtonElement>(selectors.play, "play");
  return {
    panButton: requireElement(selectors.pan, "pan tool"),
    pointerButton: requireElement(selectors.pointer, "pointer tool"),
    wallButton: requireElement(selectors.wall, "wall tool"),
    bumperButton: requireElement(selectors.bumper, "bumper tool"),
    spawnPointButton: requireElement(selectors.spawnPoint, "spawn point tool"),
    gridToggleButton: requireElement(selectors.gridToggle, "grid toggle"),
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
    statusOutput: requireElement(selectors.status, "status"),
    debugInfo: requireElement(selectors.debugInfo, "debug info"),
  };
};
