// Reference article: https://developer.ibm.com/tutorials/wa-build2dphysicsengine/

const GRAVITY_X = 0;
const GRAVITY_Y = 9.8;

export type EntityType = "kinematic" | "dynamic";

export abstract class Physical {
  abstract createPhysicsEntity(): PhysicsEntity;
}

abstract class BoundingShape {
  abstract position: [number, number];

  abstract intersects(other: BoundingShape): boolean;
}

class BoundingBox implements BoundingShape {
  private readonly _position: [number, number];
  readonly width: number;
  readonly height: number;

  constructor({
    position,
    width,
    height,
  }: {
    position: [number, number];
    width: number;
    height: number;
  }) {
    this._position = position;
    this.width = width;
    this.height = height;
  }

  set position(center: [number, number]) {
    this._position[0] = center[0];
    this._position[1] = center[1];
  }

  get position() {
    return this._position;
  }

  intersects(other: BoundingShape): boolean {
    const [x1, y1] = this.position;
    const [w1, h1] = [this.width, this.height];

    const [x2, y2] = other.position;

    if (other instanceof BoundingBox) {
      const [w2, h2] = [other.width, other.height];

      const isBoxIntersect =
        x1 - w1 / 2 < x2 + w2 / 2 &&
        x1 + w1 / 2 > x2 - w2 / 2 &&
        y1 - h1 / 2 < y2 + h2 / 2 &&
        y1 + h1 / 2 > y2 - h2 / 2;

      return isBoxIntersect;
    } else {
      throw new Error("Not implemented");
    }
  }
}

class BoundingCircle implements BoundingShape {
  private readonly _position: [number, number];
  readonly radius: number;

  constructor({
    position,
    radius,
  }: {
    position: [number, number];
    radius: number;
  }) {
    this._position = position;
    this.radius = radius;
  }

  set position(center: [number, number]) {
    this._position[0] = center[0];
    this._position[1] = center[1];
  }

  get position() {
    return this._position;
  }

  intersects(other: BoundingShape): boolean {
    if (other instanceof BoundingCircle) {
      const dx = this.position[0] - other.position[0];
      const dy = this.position[1] - other.position[1];
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance < this.radius + other.radius;
    } else {
      throw new Error("Not implemented");
    }
  }
}

// TODO: Simplify type?
type BoundingShapeParams =
  | Omit<
      ConstructorParameters<typeof BoundingBox>[0] & { type: "BoundingBox" },
      "position"
    >
  | Omit<
      ConstructorParameters<typeof BoundingCircle>[0] & {
        type: "BoundingCircle";
      },
      "position"
    >;

export class PhysicsEntity {
  readonly type: EntityType;
  readonly boundingShape: BoundingShape | undefined;

  private _position: [number, number];
  velocity: [number, number];
  acceleration: [number, number];

  constructor({
    type,
    position,
    boundingShapeParams,
    velocity,
    acceleration,
  }: {
    type: EntityType;
    boundingShapeParams: BoundingShapeParams;
    position: [number, number];
    velocity?: [number, number];
    acceleration?: [number, number];
  }) {
    this.type = type;

    if (boundingShapeParams.type === "BoundingCircle") {
      this.boundingShape = new BoundingCircle({
        ...boundingShapeParams,
        position,
      });
    } else if (boundingShapeParams.type === "BoundingBox") {
      this.boundingShape = new BoundingBox({
        ...boundingShapeParams,
        position,
      });
    } else {
      this.boundingShape = undefined;
    }

    this._position = position;
    this.velocity = velocity ?? [0, 0];
    this.acceleration = acceleration ?? [0, 0];
  }

  set position(center: [number, number]) {
    this._position[0] = center[0];
    this._position[1] = center[1];
  }

  get position() {
    return this._position;
  }
}

class CollisionDetector {
  // NOTE: Since only shapes are square and circle; therefore, should be able to
  // use AABB / Bounding Circle in a single "narrow" phase rather than a broad
  // and narrow (sufficient test in broad phase to exactly detect collision)
  detectCollisions(
    entities: PhysicsEntity[],
  ): [PhysicsEntity, PhysicsEntity][] | null {
    const collisions: [PhysicsEntity, PhysicsEntity][] = [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity.boundingShape) {
        continue;
      }

      for (let j = i + 1; j < entities.length; j++) {
        const otherEntity = entities[j];
        if (!otherEntity.boundingShape) {
          continue;
        }

        if (entity.boundingShape.intersects(otherEntity.boundingShape)) {
          collisions.push([entity, otherEntity]);
        }
      }
    }

    return collisions.length > 0 ? collisions : null;
  }
}

class CollisionResolver {
  private _restitution = 0.6;

  resolveCollisions(collisions: [PhysicsEntity, PhysicsEntity][]) {
    for (let i = 0; i < collisions.length; i++) {
      const [entity1, entity2] = collisions[i];

      this._resolveCollision(entity1, entity2);
    }
  }

  private _calculateCollisionNormal(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
  ): { normal: [number, number]; overlap: [number, number] } {
    if (
      entity1.boundingShape instanceof BoundingBox &&
      entity2.boundingShape instanceof BoundingBox
    ) {
      const [x1, y1] = entity1.position;
      const [w1, h1] = [
        entity1.boundingShape.width,
        entity1.boundingShape.height,
      ];

      const [x2, y2] = entity2.position;
      const [w2, h2] = [
        entity2.boundingShape.width,
        entity2.boundingShape.height,
      ];

      const dx = x1 - x2;
      const dy = y1 - y2;

      const overlapX = w1 / 2 + w2 / 2 - Math.abs(dx);
      const overlapY = h1 / 2 + h2 / 2 - Math.abs(dy);

      let normal: [number, number];
      if (overlapX < overlapY) {
        normal = [dx > 0 ? 1 : -1, 0];
      } else {
        normal = [0, dy > 0 ? 1 : -1];
      }

      return { normal, overlap: [overlapX, overlapY] };
    } else if (
      entity1.boundingShape instanceof BoundingCircle &&
      entity2.boundingShape instanceof BoundingCircle
    ) {
      const [x1, y1] = entity1.position;
      const [x2, y2] = entity2.position;

      const dx = x1 - x2;
      const dy = y1 - y2;

      const distance = Math.sqrt(dx * dx + dy * dy);

      const normal: [number, number] = [dx / distance, dy / distance];
      // TODO: Calculate overlap
      const overlap: [number, number] = [0, 0];

      return { normal, overlap };
    } else {
      throw new Error("Not implemented");
    }
  }

  private _correctOverlap(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity,
    normal: [number, number],
    overlap: [number, number],
    strength: number = 1,
  ) {
    if (entity1.type === "dynamic") {
      if (Math.abs(overlap[0]) > 0.1) {
        entity1.position[0] += normal[0] * overlap[0] * strength;
      }
      if (Math.abs(overlap[1]) > 0.1) {
        entity1.position[1] += normal[1] * overlap[1] * strength;
      }
    }

    if (entity2.type === "dynamic") {
      if (Math.abs(overlap[0]) > 0.1) {
        entity2.position[0] -= normal[0] * overlap[0] * strength;
      }
      if (Math.abs(overlap[1]) > 0.1) {
        entity2.position[1] -= normal[1] * overlap[1] * strength;
      }
    }
  }

  private _resolveCollision(entity1: PhysicsEntity, entity2: PhysicsEntity) {
    // Calculate collision normal
    const { normal: collNorm, overlap: collOverlap } =
      this._calculateCollisionNormal(entity1, entity2);

    // Correct Overlap (if any)
    for (let i = 0; i < 5; i++) {
      this._correctOverlap(entity1, entity2, collNorm, collOverlap, 0.2);
    }

    // Calculate relative velocity
    const relativeVelocity = [
      entity1.velocity[0] - entity2.velocity[0],
      entity1.velocity[1] - entity2.velocity[1],
    ];

    // Calculate relative velocity in terms of the normal direction
    const magAlongNormal =
      relativeVelocity[0] * collNorm[0] + relativeVelocity[1] * collNorm[1];

    // Calculate impulse magnitude
    // TODO: Fix dynamic / kinematic collision resolution (Consider dynamic
    // shape colliding with dynamic that is colliding with kinematic), all
    // shapes lose velocity in this case, when really outside shape should
    // retain incoming velocity
    if (entity1.type === "dynamic") {
      entity1.velocity[0] -= collNorm[0] * magAlongNormal * this._restitution;
      entity1.velocity[1] -= collNorm[1] * magAlongNormal * this._restitution;
    } else {
      entity2.velocity[0] += collNorm[0] * magAlongNormal * this._restitution;
      entity2.velocity[1] += collNorm[1] * magAlongNormal * this._restitution;
    }

    if (entity2.type === "dynamic") {
      entity2.velocity[0] += collNorm[0] * magAlongNormal * this._restitution;
      entity2.velocity[1] += collNorm[1] * magAlongNormal * this._restitution;
    } else {
      entity1.velocity[0] -= collNorm[0] * magAlongNormal * this._restitution;
      entity1.velocity[1] -= collNorm[1] * magAlongNormal * this._restitution;
    }
  }

  private _resolveDynamicCollision(
    entity: PhysicsEntity,
    other: PhysicsEntity,
  ) {
    if (
      entity.boundingShape instanceof BoundingBox &&
      other.boundingShape instanceof BoundingBox
    ) {
      // Resolve intersection overlap
      const mag1 = Math.sqrt(
        entity.velocity[0] * entity.velocity[0] +
          entity.velocity[1] * entity.velocity[1],
      );
      const u1 = [entity.velocity[0] / mag1, entity.velocity[1] / mag1];

      // Calculate X overlap
      const distanceX = Math.abs(entity.position[0] - other.position[0]);
      const distanceY = Math.abs(entity.position[1] - other.position[1]);

      const overlapX =
        entity.boundingShape.width / 2 +
        other.boundingShape.width / 2 -
        distanceX;
      const overlapY =
        entity.boundingShape.height / 2 +
        other.boundingShape.height / 2 -
        distanceY;

      // Calcualte minimum displacement to resolve overlap (x or y)
      let dx;
      let dy;

      // Q: Use unit vector to factor in shorter overlap?
      // (i.e. isXOverlapShorter = u1[0] * overlapX < u1[1] * overlapY)
      // However, need to address extreme where unit vector is 0 for one axis
      // but more logical for primary displacement correction
      const isXOverlapShorter = overlapX < overlapY;
      if (isXOverlapShorter) {
        dx = entity.position[0] - other.position[0] > 0 ? overlapX : -overlapX;
        dy = dx * (u1[1] / u1[0]);
      } else {
        dy = entity.position[1] - other.position[1] > 0 ? overlapY : -overlapY;
        dx = dy * (u1[0] / u1[1]);
      }

      entity.position[0] += dx;
      entity.position[1] += dy;

      // TODO: Correct velocity based on displacement correction
      // vx1 = Math.sqrt(vx1 * vx1 + 2 * entity.acceleration[0] * dx);
      // vy1 = -Math.sqrt(vy1 * vy1 + 2 * entity.acceleration[1] * dy);
      // Calculate new velocity
      switch (other.type) {
        case "dynamic": {
          break;
        }
        case "kinematic": {
          // Calculate normal vector
          let normalx;
          let normaly;
          if (isXOverlapShorter) {
            normalx = entity.position[0] > other.position[0] ? 1 : -1;
            normaly = 0;
          } else {
            normalx = 0;
            normaly = entity.position[1] > other.position[1] ? 1 : -1;
          }

          const dotx = entity.velocity[0] * normalx;
          const doty = entity.velocity[1] * normaly;

          const vx1 = entity.velocity[0] - 2 * dotx * normalx;
          const vy1 = entity.velocity[1] - 2 * doty * normaly;

          entity.velocity[0] = vx1 * this._restitution;
          entity.velocity[1] = vy1 * this._restitution;

          break;
        }
      }
    }
  }

  private _resolveKinematicCollision(
    entity: PhysicsEntity,
    other: PhysicsEntity,
  ) {}
}

class Physics {
  private _entities: PhysicsEntity[] = [];
  private _collider: CollisionDetector = new CollisionDetector();
  private _resolver: CollisionResolver = new CollisionResolver();

  add(physical: Physical) {
    const entity = physical.createPhysicsEntity();
    this._entities.push(entity);
  }

  update(elapsed: number) {
    elapsed *= 0.005;

    const gx = GRAVITY_X * elapsed;
    const gy = GRAVITY_Y * elapsed;

    for (let i = 0; i < this._entities.length; i++) {
      const entity = this._entities[i];

      entity.velocity[0] += entity.acceleration[0] * elapsed;
      entity.velocity[1] += entity.acceleration[1] * elapsed;

      entity.position[0] += entity.velocity[0] * elapsed;
      entity.position[1] += entity.velocity[1] * elapsed;

      switch (entity.type) {
        case "dynamic":
          entity.velocity[0] += gx;
          entity.velocity[1] += gy;
          break;
        case "kinematic":
          break;
      }
    }

    const collisions = this._collider.detectCollisions(this._entities);

    if (collisions) {
      this._resolver.resolveCollisions(collisions);
    }
  }
}

export default Physics;
