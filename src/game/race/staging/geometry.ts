import type { Vec2 } from "../../../engine/core/transform";
import { MAX_TEAMS, MIN_TEAMS } from "./constants";
import type {
  FittedMarbleRadiusOptions,
  StagingRackGeometry,
} from "./constants";

export const assertPositiveFinite = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
};

export const assertTeamCount = (teamCount: number) => {
  if (
    !Number.isInteger(teamCount) ||
    teamCount < MIN_TEAMS ||
    teamCount > MAX_TEAMS
  ) {
    throw new Error(`Team count must be between ${MIN_TEAMS} and ${MAX_TEAMS}`);
  }
};

export const stagingBayWidth = (
  rack: StagingRackGeometry,
  teamCount: number
) => {
  assertTeamCount(teamCount);
  assertPositiveFinite(rack.width, "Rack width");
  assertPositiveFinite(rack.wallThickness, "Rack wall thickness");
  const interiorWidth = rack.width - rack.wallThickness * 2;
  if (interiorWidth <= 0) {
    throw new Error("Rack walls leave no interior width");
  }
  return interiorWidth / teamCount;
};

export const stagingDividerPositions = (
  rack: StagingRackGeometry,
  teamCount: number
): Vec2[] => {
  const bayWidth = stagingBayWidth(rack, teamCount);
  const leftInteriorEdge =
    rack.position[0] - rack.width / 2 + rack.wallThickness;
  return Array.from({ length: teamCount - 1 }, (_, index) => [
    leftInteriorEdge + bayWidth * (index + 1),
    rack.position[1],
  ]);
};

export const stagingCapacity = ({
  rack,
  teamCount,
  marbleRadius,
  gap,
  padding,
}: {
  rack: StagingRackGeometry;
  teamCount: number;
  marbleRadius: number;
  gap: number;
  padding: number;
}) => {
  const bayWidth = stagingBayWidth(rack, teamCount);
  const usableWidth = bayWidth - rack.wallThickness - padding * 2;
  const usableHeight = rack.height - rack.wallThickness * 2 - padding * 2;
  const pitch = marbleRadius * 2 + gap;
  const columns = Math.max(0, Math.floor((usableWidth + gap) / pitch));
  const rows = Math.max(0, Math.floor((usableHeight + gap) / pitch));
  return {
    capacity: columns * rows,
    columns,
    rows,
    usableWidth,
    usableHeight,
  };
};

/** Finds the largest shared race-marble radius that fits the active round. */
export const fitStagingMarbleRadius = ({
  position,
  width,
  height,
  wallThickness,
  teamCount,
  marblesPerTeam,
  maximumRadius = 4.8,
  minimumRadius = 1.2,
  radiusStep = 0.15,
  gap = 0.6,
  padding = 3,
}: FittedMarbleRadiusOptions) => {
  assertTeamCount(teamCount);
  if (!Number.isInteger(marblesPerTeam) || marblesPerTeam < 1) {
    throw new Error("Marbles per team must be a positive integer");
  }
  assertPositiveFinite(maximumRadius, "Maximum marble radius");
  assertPositiveFinite(minimumRadius, "Minimum marble radius");
  assertPositiveFinite(radiusStep, "Marble radius step");
  if (minimumRadius > maximumRadius) {
    throw new Error("Minimum marble radius cannot exceed the maximum");
  }

  const rack = { position, width, height, wallThickness };
  const findRadius = (requiredCapacity: number) => {
    for (let step = 0; ; step++) {
      const radius = Number((maximumRadius - step * radiusStep).toFixed(10));
      if (radius < minimumRadius) {
        break;
      }
      if (
        stagingCapacity({
          rack,
          teamCount,
          marbleRadius: radius,
          gap,
          padding,
        }).capacity >= requiredCapacity
      ) {
        return radius;
      }
    }
    return null;
  };

  const radius =
    findRadius(Math.ceil(marblesPerTeam * 1.2)) ?? findRadius(marblesPerTeam);
  if (radius === null) {
    throw new Error(
      `The staging rack cannot fit ${marblesPerTeam} marbles per team`
    );
  }
  return radius;
};
