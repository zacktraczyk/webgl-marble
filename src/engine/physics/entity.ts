import * as id from "../../utils/id";
import { BoundingBox, BoundingCircle, BoundingShape } from "./boundingShape";
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
