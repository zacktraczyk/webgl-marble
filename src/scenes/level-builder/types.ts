export type BuilderElements = {
  toolbar: HTMLElement | null;
  raceControls: HTMLElement | null;
  toolLock: HTMLElement | null;
  toolHint: HTMLElement | null;
  pan: HTMLElement | null;
  pointer: HTMLElement | null;
  wall: HTMLElement | null;
  bumper: HTMLElement | null;
  spawnPoint: HTMLElement | null;
  pusherMenuToggle: HTMLElement | null;
  pusherLibrary: HTMLElement | null;
  slider: HTMLElement | null;
  spinner: HTMLElement | null;
  sweeper: HTMLElement | null;
  gridSnapToggle: HTMLElement | null;
  majorGridToggle: HTMLElement | null;
  minorGridToggle: HTMLElement | null;
  gridOverlay: HTMLElement | null;
  editorOverlay: HTMLElement | null;
  play: HTMLElement | null;
  reset: HTMLElement | null;
  zoomIn: HTMLElement | null;
  zoomOut: HTMLElement | null;
  zoomReset: HTMLElement | null;
  zoomLevel: HTMLElement | null;
  undo: HTMLElement | null;
  redo: HTMLElement | null;
  teamCount: HTMLElement | null;
  teamCountOutput: HTMLElement | null;
  marblesPerTeam: HTMLElement | null;
  marblesPerTeamOutput: HTMLElement | null;
  releaseInterval: HTMLElement | null;
  releaseIntervalOutput: HTMLElement | null;
  courseWidth: HTMLElement | null;
  courseHeight: HTMLElement | null;
  wallThickness: HTMLElement | null;
  objectInspector: HTMLElement | null;
  objectInspectorTitle: HTMLElement | null;
  motionType: HTMLElement | null;
  motionControls: HTMLElement | null;
  motionRangeRow: HTMLElement | null;
  motionRange: HTMLElement | null;
  motionRangeOutput: HTMLElement | null;
  motionReverse: HTMLElement | null;
  motionSpeedSlow: HTMLElement | null;
  motionSpeedMedium: HTMLElement | null;
  motionSpeedFast: HTMLElement | null;
  status: HTMLElement | null;
  debugInfo: HTMLElement | null;
};

export enum SelectedTool {
  Pan,
  Pointer,
  Wall,
  Bumper,
  SpawnPoint,
  Slider,
  Spinner,
  Sweeper,
}

export type PusherTool =
  | SelectedTool.Slider
  | SelectedTool.Spinner
  | SelectedTool.Sweeper;

export type RacePhase = "ready" | "running" | "paused" | "complete";

export type RoundConfiguration = {
  teamCount: number;
  marblesPerTeam: number;
  releaseIntervalMs: number;
};
