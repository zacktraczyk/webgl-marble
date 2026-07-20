import type { PhysicsEntity } from "../entity";

export type Line = [[number, number], [number, number]];

export type CollisionPair = readonly [PhysicsEntity, PhysicsEntity];

export type ContactPoint = {
  /** A representative world-space point between the two shape surfaces. */
  position: [number, number];
  /** Negative when penetrating, zero when touching. */
  separation: number;
  /** Stable geometric identifier used to match contacts between steps. */
  featureId: string;
};

export type ContactManifold = {
  /** Unit normal pointing from entity1 toward entity2. */
  normal: [number, number];
  /** Deepest penetration represented by the manifold. */
  penetrationDepth: number;
  points: ContactPoint[];
};

export type Collision = {
  entity1: PhysicsEntity;
  entity2: PhysicsEntity;
  manifold: ContactManifold;
  diagnostics?: {
    referenceEdge?: Line;
  };
};

export interface BroadPhase {
  findPairs(entities: readonly PhysicsEntity[]): CollisionPair[];
}

export interface NarrowPhase {
  detectCollision(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity
  ): Collision | null;
}

export interface ContactSolver {
  solve(collisions: readonly Collision[], deltaSeconds: number): void;
  clear?(): void;
}

export const createCollision = ({
  entity1,
  entity2,
  manifold,
  diagnostics,
}: {
  entity1: PhysicsEntity;
  entity2: PhysicsEntity;
  manifold: ContactManifold;
  diagnostics?: Collision["diagnostics"];
}): Collision => ({
  entity1,
  entity2,
  manifold,
  diagnostics,
});
