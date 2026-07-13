import type { TransformInput } from "../core/transform";

export type Color = [number, number, number, number];

export type RenderPrimitive =
  | { type: "circle"; radius: number }
  | { type: "rectangle"; width: number; height: number }
  | { type: "right-triangle"; width: number; height: number };

export interface RenderPartDefinition {
  primitive: RenderPrimitive;
  color: Color;
  /** Transform relative to the owning entity's root transform. */
  localTransform?: TransformInput;
}

export interface RenderComponentDefinition {
  parts: RenderPartDefinition[];
}
