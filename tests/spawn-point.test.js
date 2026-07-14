import { describe, expect, test } from "bun:test";
import { spawnPointDefinition } from "../src/game/prefabs/spawnPoint.ts";
import {
  DEFAULT_SPAWN_DIRECTION_VARIANCE,
  randomSpawnAngle,
} from "../src/game/race/spawn.ts";

describe("spawn point", () => {
  test("randomizes launches across the full configured direction range", () => {
    const center = Math.PI / 2;
    const variance = DEFAULT_SPAWN_DIRECTION_VARIANCE;

    expect(variance).toBeCloseTo(Math.PI / 12);
    expect(randomSpawnAngle(center, variance, () => 0)).toBeCloseTo(
      center - variance
    );
    expect(randomSpawnAngle(center, variance, () => 0.5)).toBeCloseTo(center);
    expect(randomSpawnAngle(center, variance, () => 1)).toBeCloseTo(
      center + variance
    );
  });

  test("renders two rays at the lower and upper direction bounds", () => {
    const definition = spawnPointDefinition({
      position: [0, 0],
      radius: 20,
      directionVariance: DEFAULT_SPAWN_DIRECTION_VARIANCE,
    });
    const parts = definition.render?.parts ?? [];

    expect(parts).toHaveLength(4);
    expect(parts[2].localTransform?.rotation).toBeCloseTo(
      -DEFAULT_SPAWN_DIRECTION_VARIANCE
    );
    expect(parts[3].localTransform?.rotation).toBeCloseTo(
      DEFAULT_SPAWN_DIRECTION_VARIANCE
    );
  });
});
