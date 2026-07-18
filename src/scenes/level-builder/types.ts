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

/** Era layout for one leg's finish rack, precomputed for the whole race. */
export type FinishRackPlan = {
  /** Bays rendered — the era's team count; may exceed the active teams. */
  bayCount: number;
  /** Rightmost bays X'd out for teams eliminated earlier in the era. */
  xBayCount: number;
  rackHeight: number;
};

export type RoundConfiguration = {
  teamCount: number;
  marblesPerTeam: number;
  releaseIntervalMs: number;
  /** Set by the race player; the level builder derives layout from teamCount. */
  finishPlan?: FinishRackPlan;
};
