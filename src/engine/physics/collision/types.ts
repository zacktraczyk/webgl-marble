import type { PhysicsEntity } from "../entity";

export type Line = [[number, number], [number, number]];

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

export interface CollisionDetector {
  detectCollisions(entities: PhysicsEntity[]): Collision[];
}

export interface CollisionResolver {
  resolveCollisions(collisions: Collision[], deltaSeconds: number): void;
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

/** Builds an approximate one-point manifold for diagnostic-only detectors. */
export const createApproximateManifold = ({
  entity1,
  entity2,
  normal,
  penetrationDepth,
  featureId,
}: {
  entity1: PhysicsEntity;
  entity2: PhysicsEntity;
  normal: [number, number];
  penetrationDepth: number;
  featureId: string;
}): ContactManifold => ({
  normal,
  penetrationDepth,
  points: [
    {
      position: [
        (entity1.position[0] + entity2.position[0]) / 2,
        (entity1.position[1] + entity2.position[1]) / 2,
      ],
      separation: -penetrationDepth,
      featureId,
    },
  ],
});
