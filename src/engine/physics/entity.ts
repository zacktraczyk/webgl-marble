export abstract class Physical {
  abstract createPhysicsEntity(): PhysicsEntity;
}

abstract class BoundingShape {
  abstract position: [number, number];

  abstract intersects(other: BoundingShape): boolean;
}

export class BoundingBox implements BoundingShape {
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

export class BoundingCircle implements BoundingShape {
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

export type EntityType = "kinematic" | "dynamic";

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
