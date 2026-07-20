import type { Collision, ContactPoint, ContactSolver } from "../types";
import type { PhysicsEntity } from "../../entity";
import type { Vec2 } from "../../../core/transform";
import { add, cross, dot, scale, subtract } from "../geometry";

type CachedImpulse = {
  normal: number;
  tangent: number;
};

type ContactConstraint = {
  entity1: PhysicsEntity;
  entity2: PhysicsEntity;
  point: ContactPoint;
  normal: Vec2;
  tangent: Vec2;
  offset1: Vec2;
  offset2: Vec2;
  normalMass: number;
  tangentMass: number;
  friction: number;
  restitutionBias: number;
  accumulatedNormalImpulse: number;
  accumulatedTangentImpulse: number;
  cacheKey: string;
};

export interface SequentialImpulseSolverOptions {
  velocityIterations?: number;
  restitutionThreshold?: number;
  penetrationSlop?: number;
  positionCorrectionPercent?: number;
  warmStart?: boolean;
}

/** Iterative projected Gauss-Seidel contact solver with warm starting. */
export class SequentialImpulseSolver implements ContactSolver {
  private readonly _velocityIterations: number;
  private readonly _restitutionThreshold: number;
  private readonly _penetrationSlop: number;
  private readonly _positionCorrectionPercent: number;
  private readonly _warmStart: boolean;
  private _impulseCache = new Map<string, CachedImpulse>();
  private _previousDeltaSeconds: number | null = null;

  constructor({
    velocityIterations = 10,
    restitutionThreshold = 1,
    penetrationSlop = 0.5,
    positionCorrectionPercent = 0.8,
    warmStart = true,
  }: SequentialImpulseSolverOptions = {}) {
    if (!Number.isInteger(velocityIterations) || velocityIterations < 1) {
      throw new Error(
        "Sequential impulse iterations must be a positive integer"
      );
    }
    if (!Number.isFinite(restitutionThreshold) || restitutionThreshold < 0) {
      throw new Error("Restitution threshold must be finite and non-negative");
    }
    if (!Number.isFinite(penetrationSlop) || penetrationSlop < 0) {
      throw new Error("Penetration slop must be finite and non-negative");
    }
    if (
      !Number.isFinite(positionCorrectionPercent) ||
      positionCorrectionPercent < 0 ||
      positionCorrectionPercent > 1
    ) {
      throw new Error("Position correction percent must be between 0 and 1");
    }
    this._velocityIterations = velocityIterations;
    this._restitutionThreshold = restitutionThreshold;
    this._penetrationSlop = penetrationSlop;
    this._positionCorrectionPercent = positionCorrectionPercent;
    this._warmStart = warmStart;
  }

  solve(collisions: readonly Collision[], deltaSeconds: number) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      throw new Error("Collision resolution requires a positive time step");
    }
    const warmStartScale = this._previousDeltaSeconds
      ? deltaSeconds / this._previousDeltaSeconds
      : 1;
    const constraints = collisions.flatMap((collision) =>
      this._prepareCollision(collision, warmStartScale)
    );

    if (this._warmStart) {
      for (const constraint of constraints) {
        const impulse = add(
          scale(constraint.normal, constraint.accumulatedNormalImpulse),
          scale(constraint.tangent, constraint.accumulatedTangentImpulse)
        );
        this._applyImpulse(constraint, impulse);
      }
    }

    for (let iteration = 0; iteration < this._velocityIterations; iteration++) {
      for (const constraint of constraints) {
        this._solveNormal(constraint);
        this._solveFriction(constraint);
      }
    }

    const nextCache = new Map<string, CachedImpulse>();
    for (const constraint of constraints) {
      nextCache.set(constraint.cacheKey, {
        normal: constraint.accumulatedNormalImpulse,
        tangent: constraint.accumulatedTangentImpulse,
      });
    }
    this._impulseCache = nextCache;
    this._previousDeltaSeconds = deltaSeconds;

    this._correctPositions(collisions);
  }

  clear() {
    this._impulseCache.clear();
    this._previousDeltaSeconds = null;
  }

  private _prepareCollision(
    collision: Collision,
    warmStartScale: number
  ): ContactConstraint[] {
    const { entity1, entity2, manifold } = collision;
    const normal = manifold.normal;
    const tangent: Vec2 = [-normal[1], normal[0]];
    const friction = Math.sqrt(entity1.friction * entity2.friction);
    const restitution = Math.max(entity1.restitution, entity2.restitution);

    return manifold.points.flatMap((point) => {
      const offset1 = subtract(point.position, entity1.position);
      const offset2 = subtract(point.position, entity2.position);
      const normalDenominator = this._effectiveMassDenominator(
        entity1,
        entity2,
        offset1,
        offset2,
        normal
      );
      const tangentDenominator = this._effectiveMassDenominator(
        entity1,
        entity2,
        offset1,
        offset2,
        tangent
      );
      if (normalDenominator <= Number.EPSILON) {
        return [];
      }

      const relativeVelocity = this._relativeContactVelocity(
        entity1,
        entity2,
        offset1,
        offset2
      );
      const normalVelocity = dot(relativeVelocity, normal);
      const cacheKey = `${entity1.id}:${entity2.id}:${point.featureId}`;
      const cached = this._warmStart
        ? this._impulseCache.get(cacheKey)
        : undefined;

      return [
        {
          entity1,
          entity2,
          point,
          normal,
          tangent,
          offset1,
          offset2,
          normalMass: 1 / normalDenominator,
          tangentMass:
            tangentDenominator > Number.EPSILON ? 1 / tangentDenominator : 0,
          friction,
          restitutionBias:
            normalVelocity < -this._restitutionThreshold
              ? -restitution * normalVelocity
              : 0,
          accumulatedNormalImpulse: (cached?.normal ?? 0) * warmStartScale,
          accumulatedTangentImpulse: (cached?.tangent ?? 0) * warmStartScale,
          cacheKey,
        },
      ];
    });
  }

  private _solveNormal(constraint: ContactConstraint) {
    const relativeVelocity = this._relativeContactVelocity(
      constraint.entity1,
      constraint.entity2,
      constraint.offset1,
      constraint.offset2
    );
    const normalVelocity = dot(relativeVelocity, constraint.normal);
    const impulseDelta =
      constraint.normalMass * (constraint.restitutionBias - normalVelocity);
    const previousImpulse = constraint.accumulatedNormalImpulse;
    constraint.accumulatedNormalImpulse = Math.max(
      previousImpulse + impulseDelta,
      0
    );
    const appliedImpulse =
      constraint.accumulatedNormalImpulse - previousImpulse;
    this._applyImpulse(constraint, scale(constraint.normal, appliedImpulse));
  }

  private _solveFriction(constraint: ContactConstraint) {
    const relativeVelocity = this._relativeContactVelocity(
      constraint.entity1,
      constraint.entity2,
      constraint.offset1,
      constraint.offset2
    );
    const tangentVelocity = dot(relativeVelocity, constraint.tangent);
    const impulseDelta = -constraint.tangentMass * tangentVelocity;
    const maximumFrictionImpulse =
      constraint.friction * constraint.accumulatedNormalImpulse;
    const previousImpulse = constraint.accumulatedTangentImpulse;
    constraint.accumulatedTangentImpulse = clamp(
      previousImpulse + impulseDelta,
      -maximumFrictionImpulse,
      maximumFrictionImpulse
    );
    const appliedImpulse =
      constraint.accumulatedTangentImpulse - previousImpulse;
    this._applyImpulse(constraint, scale(constraint.tangent, appliedImpulse));
  }

  private _applyImpulse(constraint: ContactConstraint, impulse: Vec2) {
    const { entity1, entity2, offset1, offset2 } = constraint;
    entity1.velocity[0] -= impulse[0] * entity1.inverseMass;
    entity1.velocity[1] -= impulse[1] * entity1.inverseMass;
    entity1.angularVelocity -= cross(offset1, impulse) * entity1.inverseInertia;

    entity2.velocity[0] += impulse[0] * entity2.inverseMass;
    entity2.velocity[1] += impulse[1] * entity2.inverseMass;
    entity2.angularVelocity += cross(offset2, impulse) * entity2.inverseInertia;
  }

  private _relativeContactVelocity(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
    offset1: Vec2,
    offset2: Vec2
  ) {
    const velocity1 = add(
      entity1.velocity,
      angularVelocityAtOffset(entity1.angularVelocity, offset1)
    );
    const velocity2 = add(
      entity2.velocity,
      angularVelocityAtOffset(entity2.angularVelocity, offset2)
    );
    return subtract(velocity2, velocity1);
  }

  private _effectiveMassDenominator(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
    offset1: Vec2,
    offset2: Vec2,
    direction: Vec2
  ) {
    const offsetCrossDirection1 = cross(offset1, direction);
    const offsetCrossDirection2 = cross(offset2, direction);
    return (
      entity1.inverseMass +
      entity2.inverseMass +
      offsetCrossDirection1 * offsetCrossDirection1 * entity1.inverseInertia +
      offsetCrossDirection2 * offsetCrossDirection2 * entity2.inverseInertia
    );
  }

  private _correctPositions(collisions: readonly Collision[]) {
    for (const { entity1, entity2, manifold } of collisions) {
      const inverseMass = entity1.inverseMass + entity2.inverseMass;
      if (inverseMass <= Number.EPSILON) {
        continue;
      }
      const deepestPenetration = Math.max(
        0,
        ...manifold.points.map((point) => -point.separation)
      );
      const correctedDepth = Math.max(
        deepestPenetration - this._penetrationSlop,
        0
      );
      const correctionMagnitude =
        (correctedDepth * this._positionCorrectionPercent) / inverseMass;
      const correction = scale(manifold.normal, correctionMagnitude);

      entity1.position[0] -= correction[0] * entity1.inverseMass;
      entity1.position[1] -= correction[1] * entity1.inverseMass;
      entity2.position[0] += correction[0] * entity2.inverseMass;
      entity2.position[1] += correction[1] * entity2.inverseMass;
    }
  }
}

const angularVelocityAtOffset = (
  angularVelocity: number,
  offset: Vec2
): Vec2 => [-angularVelocity * offset[1], angularVelocity * offset[0]];
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));
