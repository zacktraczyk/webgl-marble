export type BuilderElements = {
  pan: HTMLElement | null;
  pointer: HTMLElement | null;
  wall: HTMLElement | null;
  bumper: HTMLElement | null;
  spawnPoint: HTMLElement | null;
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
  teamCount: HTMLElement | null;
  teamCountOutput: HTMLElement | null;
  marblesPerTeam: HTMLElement | null;
  marblesPerTeamOutput: HTMLElement | null;
  releaseInterval: HTMLElement | null;
  releaseIntervalOutput: HTMLElement | null;
  courseWidth: HTMLElement | null;
  courseHeight: HTMLElement | null;
  status: HTMLElement | null;
  debugInfo: HTMLElement | null;
};

export enum SelectedTool {
  Pan,
  Pointer,
  Wall,
  Bumper,
  SpawnPoint,
}

export type RacePhase = "ready" | "running" | "paused" | "complete";

export type RoundConfiguration = {
  teamCount: number;
  marblesPerTeam: number;
  releaseIntervalMs: number;
};
