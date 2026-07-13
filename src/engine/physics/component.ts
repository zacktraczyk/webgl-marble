import type { Vec2 } from "../core/transform";
import type { PhysicsEntityType } from "./entity";

export type ColliderDefinition =
  | {
      type: "circle";
      radius: number;
    }
  | {
      type: "polygon";
      vertices: Vec2[];
    };

export interface PhysicsComponentDefinition {
  type: PhysicsEntityType;
  velocity?: Vec2;
  angularVelocity?: number;
  acceleration?: Vec2;
  collider: ColliderDefinition;
}
