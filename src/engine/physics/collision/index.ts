import { PhysicsEntity } from "../entity";

export type Line = [[number, number], [number, number]];

export type CollisionPair = [PhysicsEntity, PhysicsEntity];

export type Collision = {
  entity1: PhysicsEntity;
  entity2: PhysicsEntity;
  edge: Line | null; // NOTE: Only for debugging
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
