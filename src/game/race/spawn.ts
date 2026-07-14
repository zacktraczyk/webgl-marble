export const DEFAULT_SPAWN_DIRECTION_VARIANCE = Math.PI / 12;

export const randomSpawnAngle = (
  centerAngle: number,
  directionVariance = DEFAULT_SPAWN_DIRECTION_VARIANCE,
  random: () => number = Math.random
) => centerAngle + (random() * 2 - 1) * Math.abs(directionVariance);
