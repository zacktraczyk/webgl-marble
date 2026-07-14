import type { Vec2 } from "../../engine/core/transform";
import type { Color } from "../../engine/vdu/component";

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
  distribution?: "scattered" | "stacked";
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
  gap?: number;
  padding?: number;
}

const assertPositiveFinite = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
};

const assertTeamCount = (teamCount: number) => {
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

const stagingCapacity = ({
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
  maximumRadius = 8,
  minimumRadius = 2,
  gap = 1,
  padding = 5,
}: FittedMarbleRadiusOptions) => {
  assertTeamCount(teamCount);
  if (!Number.isInteger(marblesPerTeam) || marblesPerTeam < 1) {
    throw new Error("Marbles per team must be a positive integer");
  }
  assertPositiveFinite(maximumRadius, "Maximum marble radius");
  assertPositiveFinite(minimumRadius, "Minimum marble radius");
  if (minimumRadius > maximumRadius) {
    throw new Error("Minimum marble radius cannot exceed the maximum");
  }

  const rack = { position, width, height, wallThickness };
  const findRadius = (requiredCapacity: number) => {
    for (let radius = maximumRadius; radius >= minimumRadius; radius -= 0.25) {
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

export const createStagingMarblePlacements = ({
  position,
  width,
  height,
  wallThickness,
  teamCount,
  marblesPerTeam,
  marbleRadius,
  gap = 3,
  padding = 5,
  random = Math.random,
  distribution = "scattered",
}: StagingLayoutOptions): StagingMarblePlacement[] => {
  assertTeamCount(teamCount);
  if (!Number.isInteger(marblesPerTeam) || marblesPerTeam < 1) {
    throw new Error("Marbles per team must be a positive integer");
  }
  assertPositiveFinite(height, "Rack height");
  assertPositiveFinite(marbleRadius, "Marble radius");
  if (
    !Number.isFinite(gap) ||
    gap < 0 ||
    !Number.isFinite(padding) ||
    padding < 0
  ) {
    throw new Error("Rack spacing must be finite and non-negative");
  }

  const rack = { position, width, height, wallThickness };
  const bayWidth = stagingBayWidth(rack, teamCount);
  const diameter = marbleRadius * 2;
  const pitch = diameter + gap;
  const { capacity, columns, rows, usableWidth } = stagingCapacity({
    rack,
    teamCount,
    marbleRadius,
    gap,
    padding,
  });
  if (marblesPerTeam > capacity) {
    throw new Error(
      `The staging rack fits ${capacity} marbles per team with ${teamCount} teams`
    );
  }

  const leftInteriorEdge = position[0] - width / 2 + wallThickness;
  const gridWidth = columns * diameter + Math.max(0, columns - 1) * gap;
  const gridHeight = rows * diameter + Math.max(0, rows - 1) * gap;
  const placements: StagingMarblePlacement[] = [];

  const shuffle = <T>(items: T[]) => {
    for (let index = items.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  };

  for (let teamIndex = 0; teamIndex < teamCount; teamIndex++) {
    const bayCenterX = leftInteriorEdge + bayWidth * (teamIndex + 0.5);
    const jitter = gap / 3;

    if (distribution === "stacked") {
      const minimumX = bayCenterX - usableWidth / 2 + marbleRadius;
      const maximumX = bayCenterX + usableWidth / 2 - marbleRadius;
      const minimumY =
        position[1] - height / 2 + wallThickness + padding + marbleRadius;
      const bottomY =
        position[1] + height / 2 - wallThickness - padding - marbleRadius;
      const candidateSamples = Math.max(24, columns * 5);

      const createPackedLayout = () => {
        const packedPositions: Vec2[] = [];
        for (let slotIndex = 0; slotIndex < marblesPerTeam; slotIndex++) {
          const candidateXs = [minimumX, maximumX];
          for (let sample = 0; sample < candidateSamples; sample++) {
            candidateXs.push(minimumX + random() * (maximumX - minimumX));
          }
          for (const [supportX] of packedPositions) {
            candidateXs.push(supportX - pitch, supportX + pitch);
          }

          const supportGapXs: number[] = [];
          for (let first = 0; first < packedPositions.length; first++) {
            const [firstX, firstY] = packedPositions[first];
            for (
              let second = first + 1;
              second < packedPositions.length;
              second++
            ) {
              const [secondX, secondY] = packedPositions[second];
              const deltaX = secondX - firstX;
              const deltaY = secondY - firstY;
              const supportDistance = Math.hypot(deltaX, deltaY);
              if (supportDistance <= 0 || supportDistance > pitch * 2) {
                continue;
              }
              const midpointX = (firstX + secondX) / 2;
              const midpointY = (firstY + secondY) / 2;
              const intersectionOffset = Math.sqrt(
                Math.max(0, pitch ** 2 - (supportDistance / 2) ** 2)
              );
              const perpendicularX = -deltaY / supportDistance;
              for (const direction of [-1, 1]) {
                const candidateX =
                  midpointX + perpendicularX * intersectionOffset * direction;
                const candidateY =
                  midpointY +
                  (deltaX / supportDistance) * intersectionOffset * direction;
                if (
                  candidateY <= Math.min(firstY, secondY) + pitch / 4 &&
                  candidateX >= minimumX &&
                  candidateX <= maximumX
                ) {
                  supportGapXs.push(candidateX);
                }
              }
            }
          }
          shuffle(supportGapXs);
          candidateXs.push(...supportGapXs.slice(0, candidateSamples));

          let bestY = Number.NEGATIVE_INFINITY;
          let bestXs: number[] = [];
          const testedXs = new Set<number>();
          for (const rawCandidateX of candidateXs) {
            const candidateX = Math.min(
              maximumX,
              Math.max(minimumX, rawCandidateX)
            );
            const roundedX = Math.round(candidateX * 1_000_000);
            if (testedXs.has(roundedX)) {
              continue;
            }
            testedXs.add(roundedX);

            let candidateY = bottomY;
            for (const [supportX, supportY] of packedPositions) {
              const horizontalDistance = Math.abs(candidateX - supportX);
              if (horizontalDistance < pitch) {
                candidateY = Math.min(
                  candidateY,
                  supportY -
                    Math.sqrt(Math.max(0, pitch ** 2 - horizontalDistance ** 2))
                );
              }
            }
            if (candidateY < minimumY) {
              continue;
            }
            if (candidateY > bestY + 1e-6) {
              bestY = candidateY;
              bestXs = [candidateX];
            } else if (Math.abs(candidateY - bestY) <= 1e-6) {
              bestXs.push(candidateX);
            }
          }

          if (bestXs.length === 0) {
            return null;
          }
          packedPositions.push([
            bestXs[Math.floor(random() * bestXs.length)],
            bestY,
          ]);
        }
        return packedPositions;
      };

      let packedPositions: Vec2[] | null = null;
      for (let attempt = 0; attempt < 8 && !packedPositions; attempt++) {
        packedPositions = createPackedLayout();
      }
      if (!packedPositions) {
        throw new Error(
          `The staging rack could not pack ${marblesPerTeam} marbles per team`
        );
      }
      for (let slotIndex = 0; slotIndex < packedPositions.length; slotIndex++) {
        placements.push({
          teamIndex,
          slotIndex,
          position: packedPositions[slotIndex],
        });
      }
      continue;
    }

    const firstX = bayCenterX - gridWidth / 2 + marbleRadius;
    const firstY = position[1] - gridHeight / 2 + marbleRadius;
    const slots = shuffle(
      Array.from({ length: capacity }, (_, slotIndex) => ({
        column: slotIndex % columns,
        row: Math.floor(slotIndex / columns),
      }))
    );
    for (let slotIndex = 0; slotIndex < marblesPerTeam; slotIndex++) {
      const { column, row } = slots[slotIndex];
      placements.push({
        teamIndex,
        slotIndex,
        position: [
          firstX + column * pitch + (random() * 2 - 1) * jitter,
          firstY + row * pitch + (random() * 2 - 1) * jitter,
        ],
      });
    }
  }

  return placements;
};

/** Fairly interleaves team queues and supports a rotated first team per round. */
export class RoundRobinReleaseQueue<T> {
  private readonly _queues: T[][];
  private _nextTeam: number;
  private _remaining: number;

  constructor(queues: readonly (readonly T[])[], startingTeam = 0) {
    if (queues.length < MIN_TEAMS || queues.length > MAX_TEAMS) {
      throw new Error(`Release queues must contain 1 to ${MAX_TEAMS} teams`);
    }
    if (!Number.isInteger(startingTeam)) {
      throw new Error("Starting team must be an integer");
    }
    this._queues = queues.map((queue) => [...queue]);
    this._nextTeam =
      ((startingTeam % queues.length) + queues.length) % queues.length;
    this._remaining = this._queues.reduce(
      (total, queue) => total + queue.length,
      0
    );
  }

  takeNext(): T | null {
    if (this._remaining === 0) {
      return null;
    }
    for (let offset = 0; offset < this._queues.length; offset++) {
      const teamIndex = (this._nextTeam + offset) % this._queues.length;
      const item = this._queues[teamIndex].shift();
      if (item !== undefined) {
        this._nextTeam = (teamIndex + 1) % this._queues.length;
        this._remaining--;
        return item;
      }
    }
    return null;
  }

  get remaining() {
    return this._remaining;
  }
}
