// Reference article: https://developer.ibm.com/tutorials/wa-build2dphysicsengine/

const GRAVITY_X = 0;
const GRAVITY_Y = 0.003;

export type EntityType = "kinematic" | "dynamic";

export type BoundingBoxShape =
  | {
      type: "AABB";
      width: number;
      height: number;
    }
  | {
      type: "Circle";
      radius: number;
    };

export abstract class Physical {
  abstract createPhysicsEntity(): PhysicsEntity;
}

class BoundingBox {
  private readonly _position: [number, number];
  readonly shape: BoundingBoxShape;

  constructor({
    position,
    shape,
  }: {
    position: [number, number];
    shape: BoundingBoxShape;
  }) {
    this._position = position;
    this.shape = shape;
  }

  set position(center: [number, number]) {
    this._position[0] = center[0];
    this._position[1] = center[1];
  }

  get position() {
    return this._position;
  }

  private _intersectsAABB(other: BoundingBox) {
    if (this.shape.type !== "AABB" || other.shape.type !== "AABB") {
      throw new Error(
        `Invalid shape types: ${this.shape.type} and ${other.shape.type}`,
      );
    }

    return (
      this.position[0] < other.position[0] + other.shape.width &&
      this.position[0] + this.shape.width > other.position[0] &&
      this.position[1] < other.position[1] + other.shape.height &&
      this.position[1] + this.shape.height > other.position[1]
    );
  }

  private _intersectsCircle(other: BoundingBox) {
    if (this.shape.type !== "Circle" || other.shape.type !== "Circle") {
      throw new Error(
        `Invalid shape types: ${this.shape.type} and ${other.shape.type}`,
      );
    }

    const dx = this.position[0] - other.position[0];
    const dy = this.position[1] - other.position[1];
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < this.shape.radius + other.shape.radius;
  }

  // TODO: Verify correct?
  private _intersectsAABBCircle(other: BoundingBox) {
    throw new Error("Not implemented");
  }

  intersects(other: BoundingBox) {
    if (this.shape.type === "AABB" && other.shape.type === "AABB") {
      return this._intersectsAABB(other);
    } else if (this.shape.type === "Circle" && other.shape.type === "Circle") {
      return this._intersectsCircle(other);
    } else {
      return this._intersectsAABBCircle(other);
    }
  }
}

export class PhysicsEntity {
  readonly type: EntityType;
  readonly boundingBox: BoundingBox;

  private _position: [number, number];
  velocity: [number, number];
  acceleration: [number, number];

  constructor({
    type,
    position,
    boundingBoxParams,
    velocity,
    acceleration,
  }: {
    type: EntityType;
    boundingBoxParams: Omit<
      ConstructorParameters<typeof BoundingBox>[0],
      "position"
    >;
    position: [number, number];
    velocity?: [number, number];
    acceleration?: [number, number];
  }) {
    this.type = type;
    this.boundingBox = new BoundingBox({
      position,
      ...boundingBoxParams,
    });

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
    const BroadCollisions = this._testAABBOverlap(entities);
    // TODO: Narrow phase collision detection ?
    return BroadCollisions;
  }

  private _testAABBOverlap(
    entities: PhysicsEntity[],
  ): [PhysicsEntity, PhysicsEntity][] | null {
    const collisions: [PhysicsEntity, PhysicsEntity][] = [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      for (let j = i + 1; j < entities.length; j++) {
        const otherEntity = entities[j];
        if (entity.boundingBox.intersects(otherEntity.boundingBox)) {
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

      switch (entity1.type) {
        case "dynamic":
          this._resolveDynamicCollision(entity1, entity2);
          break;
        case "kinematic":
          this._resolveKinematicCollision(entity1, entity2);
          break;
      }

      switch (entity2.type) {
        case "dynamic":
          this._resolveDynamicCollision(entity2, entity1);
          break;
        case "kinematic":
          this._resolveKinematicCollision(entity2, entity1);
          break;
      }
    }
  }

  private _resolveDynamicCollision(
    entity: PhysicsEntity,
    other: PhysicsEntity,
  ) {}

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
    const gx = GRAVITY_X * elapsed;
    const gy = GRAVITY_Y * elapsed;

    for (let i = 0; i < this._entities.length; i++) {
      const entity = this._entities[i];
      switch (entity.type) {
        case "dynamic":
          entity.velocity[0] = entity.acceleration[0] * elapsed + gx;
          entity.velocity[1] = entity.acceleration[1] * elapsed + gy;
          entity.position[0] += entity.velocity[0] * elapsed;
          entity.position[1] += entity.velocity[1] * elapsed;
          break;
        case "kinematic":
          entity.velocity[0] = entity.acceleration[0] * elapsed;
          entity.velocity[1] = entity.acceleration[1] * elapsed;
          entity.position[0] += entity.velocity[0] * elapsed;
          entity.position[1] += entity.velocity[1] * elapsed;
          break;
      }
    }

    // const collisions = this._collider.detectCollisions(this._entities);

    // if (collisions) {
    //   this._resolver.resolveCollisions(collisions);
    // }
  }
}

export default Physics;
