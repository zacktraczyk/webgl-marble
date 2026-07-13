import type { PhysicsEntity } from "../../entity";
import type { BroadPhase, CollisionPair } from "../types";
import { aabbsOverlap, computeWorldAabb, type Aabb } from "./aabb";

type BroadPhaseEntry = {
  entity: PhysicsEntity;
  aabb: Aabb;
};

/**
 * Performs an O(n²) pair scan using cheap AABB overlap tests before the
 * narrow phase. AABBs are computed once per body per step.
 */
export class NaiveAabbBroadPhase implements BroadPhase {
  findPairs(entities: readonly PhysicsEntity[]): CollisionPair[] {
    const entries: BroadPhaseEntry[] = [];
    for (const entity of entities) {
      const aabb = computeWorldAabb(entity);
      if (aabb) {
        entries.push({ entity, aabb });
      }
    }

    const pairs: CollisionPair[] = [];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (aabbsOverlap(entries[i].aabb, entries[j].aabb)) {
          pairs.push([entries[i].entity, entries[j].entity]);
        }
      }
    }
    return pairs;
  }
}
