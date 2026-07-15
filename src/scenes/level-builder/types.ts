export enum SelectedTool {
  Pan,
  Pointer,
  Wall,
  SpawnPoint,
  Slider,
  Spinner,
  Sweeper,
}

export type PusherTool =
  | SelectedTool.Slider
  | SelectedTool.Spinner
  | SelectedTool.Sweeper;

export const isPusherTool = (tool: SelectedTool): tool is PusherTool =>
  tool === SelectedTool.Slider ||
  tool === SelectedTool.Spinner ||
  tool === SelectedTool.Sweeper;

export const isCreationTool = (tool: SelectedTool) =>
  tool === SelectedTool.Wall ||
  tool === SelectedTool.SpawnPoint ||
  isPusherTool(tool);

export type RacePhase = "ready" | "running" | "paused" | "complete";

export type RoundConfiguration = {
  teamCount: number;
  marblesPerTeam: number;
  releaseIntervalMs: number;
};
