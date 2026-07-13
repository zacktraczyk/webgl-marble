import type { PhysicsEntity } from "../../entity";
import type { BroadPhase, CollisionPair } from "../types";

/**
 * Generates every unique body pair. This preserves the original O(n²)
 * behavior behind a replaceable broad-phase boundary.
 */
export class BruteForceBroadPhase implements BroadPhase {
  findPairs(entities: readonly PhysicsEntity[]): CollisionPair[] {
    const pairs: CollisionPair[] = [];
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        pairs.push([entities[i], entities[j]]);
      }
    }
    return pairs;
  }
}
