import * as id from "../../utils/id";

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
    } else if (other instanceof BoundingCircle) {
      const r2 = other.radius;

      const dx = Math.abs(x1 - x2) - w1 / 2 - r2;
      const dy = Math.abs(y1 - y2) - h1 / 2 - r2;

      return dx < 0 && dy < 0;
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
    const [x1, y1] = this.position;
    const r1 = this.radius;

    const [x2, y2] = other.position;

    if (other instanceof BoundingCircle) {
      const r2 = other.radius;

      const dx = x1 - x2;
      const dy = y1 - y2;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance < r1 + r2;
    } else if (other instanceof BoundingBox) {
      const [w1, h1] = [other.width, other.height];

      const dx = Math.abs(this.position[0] - x1) - w1 / 2 - r1;
      const dy = Math.abs(this.position[1] - y1) - h1 / 2 - r1;

      return dx < 0 && dy < 0;
    } else {
      throw new Error("Not implemented");
    }
  }
}

export type PhysicsEntityType = "kinematic" | "dynamic";

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

export interface Physical {
  physicsEntity: PhysicsEntity;

  delete(): void;
}

export class PhysicsEntity {
  readonly parent: Physical;
  readonly id: number;
  readonly type: PhysicsEntityType;
  readonly boundingShape: BoundingShape | undefined;

  position: [number, number];
  velocity: [number, number];
  acceleration: [number, number];

  markedForDeletion: boolean = false;

  constructor({
    parent,
    type,
    position,
    boundingShapeParams,
    velocity,
    acceleration,
  }: {
    parent: Physical;
    type: PhysicsEntityType;
    boundingShapeParams: BoundingShapeParams;
    position: [number, number];
    velocity?: [number, number];
    acceleration?: [number, number];
  }) {
    this.parent = parent;
    this.id = id.getNext();
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

    this.position = position;
    this.velocity = velocity ?? [0, 0];
    this.acceleration = acceleration ?? [0, 0];
  }

  delete() {
    if (this.markedForDeletion) {
      throw new Error(
        "Could not delete physics entity: already marked for deletion",
      );
    }
    this.markedForDeletion = true;
  }
}
