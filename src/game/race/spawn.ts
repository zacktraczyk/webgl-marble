export const DEFAULT_SPAWN_DIRECTION_VARIANCE = Math.PI / 6;

export const randomSpawnAngle = (
  centerAngle: number,
  directionVariance = DEFAULT_SPAWN_DIRECTION_VARIANCE,
  random: () => number = Math.random
) => centerAngle + (random() * 2 - 1) * Math.abs(directionVariance);

export const spawnAreaRadius = (
  minimumRadius: number,
  marbleCount: number,
  marbleRadius: number
) => {
  if (!Number.isInteger(marbleCount) || marbleCount < 1) {
    throw new Error("Spawn marble count must be a positive integer");
  }
  if (!Number.isFinite(minimumRadius) || minimumRadius <= 0) {
    throw new Error("Minimum spawn radius must be positive and finite");
  }
  if (!Number.isFinite(marbleRadius) || marbleRadius <= 0) {
    throw new Error("Spawn marble radius must be positive and finite");
  }
  return Math.max(
    minimumRadius,
    marbleRadius * (Math.sqrt(marbleCount) * 1.5 + 1)
  );
};

/** Uses best-candidate sampling to spread a wave across a circular spawn area. */
export const randomSpawnOffsetsInCircle = (
  marbleCount: number,
  areaRadius: number,
  marbleRadius: number,
  random: () => number = Math.random
) => {
  const minimumAreaRadius = spawnAreaRadius(1, marbleCount, marbleRadius);
  if (!Number.isFinite(areaRadius) || areaRadius < minimumAreaRadius) {
    throw new Error("Spawn area is too small for the marble wave");
  }
  const centerLimit = areaRadius - marbleRadius;
  const offsets: [number, number][] = [];

  for (let index = 0; index < marbleCount; index++) {
    let bestPosition: [number, number] = [0, 0];
    let bestClearance = Number.NEGATIVE_INFINITY;
    for (let sample = 0; sample < 64; sample++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * centerLimit;
      const candidate: [number, number] = [
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
      ];
      const clearance = offsets.reduce(
        (nearest, position) =>
          Math.min(
            nearest,
            Math.hypot(candidate[0] - position[0], candidate[1] - position[1])
          ),
        Number.POSITIVE_INFINITY
      );
      if (clearance > bestClearance) {
        bestClearance = clearance;
        bestPosition = candidate;
      }
    }
    offsets.push(bestPosition);
  }

  return offsets;
};
