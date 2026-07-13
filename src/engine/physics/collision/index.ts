import { PhysicsEntity } from "../entity";

export type Line = [[number, number], [number, number]];

export type CollisionPair = [PhysicsEntity, PhysicsEntity];

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
  edge?: Line | null; // NOTE: Only for debugging
  manifold: ContactManifold;
  /** @deprecated Use manifold. Retained while the existing resolver is replaced. */
  minimumTranslationVector: {
    normal: [number, number];
    magnitude: number;
  };
  // restitution: number;
  // magAlongNormal: number;
};

export interface CollisionDetector {
  detectCollisions(entities: PhysicsEntity[]): Collision[] | null;
}

export interface CollisionResolver {
  resolveCollisions(collisions: Collision[]): void;
}

export const createCollision = ({
  entity1,
  entity2,
  manifold,
  edge = null,
}: {
  entity1: PhysicsEntity;
  entity2: PhysicsEntity;
  manifold: ContactManifold;
  edge?: Line | null;
}): Collision => ({
  entity1,
  entity2,
  edge,
  manifold,
  minimumTranslationVector: {
    normal: manifold.normal,
    magnitude: manifold.penetrationDepth,
  },
});

/** Compatibility helper for diagnostic detectors that do not compute witnesses. */
export const createFallbackManifold = ({
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
