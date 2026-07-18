import type { Vec2 } from "../../../engine/core/transform";
import type { Color } from "../../../engine/vdu/component";

export const MIN_TEAMS = 1;
export const MAX_TEAMS = 12;

export const TEAM_COLORS: readonly Color[] = [
  [56 / 255, 189 / 255, 248 / 255, 1],
  [34 / 255, 197 / 255, 94 / 255, 1],
  [239 / 255, 68 / 255, 68 / 255, 1],
  [250 / 255, 204 / 255, 21 / 255, 1],
  [168 / 255, 85 / 255, 247 / 255, 1],
  [249 / 255, 115 / 255, 22 / 255, 1],
  [244 / 255, 114 / 255, 182 / 255, 1],
  [146 / 255, 64 / 255, 14 / 255, 1],
  [45 / 255, 212 / 255, 191 / 255, 1],
  [99 / 255, 102 / 255, 241 / 255, 1],
  [163 / 255, 230 / 255, 53 / 255, 1],
  [248 / 255, 250 / 255, 252 / 255, 1],
];

export const TEAM_NAMES = [
  "Blue",
  "Green",
  "Red",
  "Yellow",
  "Purple",
  "Orange",
  "Pink",
  "Brown",
  "Teal",
  "Indigo",
  "Lime",
  "White",
] as const;

export interface StagingRackGeometry {
  position: Vec2;
  width: number;
  height: number;
  wallThickness: number;
}

export interface StagingLayoutOptions extends StagingRackGeometry {
  teamCount: number;
  marblesPerTeam: number;
  marbleRadius: number;
  gap?: number;
  padding?: number;
  random?: () => number;
  distribution?: "scattered" | "stacked" | "grid";
}

export interface StagingMarblePlacement {
  teamIndex: number;
  slotIndex: number;
  position: Vec2;
}

export interface FittedMarbleRadiusOptions extends StagingRackGeometry {
  teamCount: number;
  marblesPerTeam: number;
  maximumRadius?: number;
  minimumRadius?: number;
  radiusStep?: number;
  gap?: number;
  padding?: number;
}
