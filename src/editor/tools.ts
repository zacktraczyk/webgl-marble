import type { PusherKind } from "../game/level/types";

export enum SelectedTool {
  Pan,
  Pointer,
  Wall,
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
  tool === SelectedTool.Wall || isPusherTool(tool);

export const pusherKindFromTool = (tool: PusherTool): PusherKind => {
  switch (tool) {
    case SelectedTool.Slider:
      return "slider";
    case SelectedTool.Spinner:
      return "spinner";
    case SelectedTool.Sweeper:
      return "sweeper";
  }
};
