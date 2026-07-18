import type { BoundingConvexPolygon } from "../entity";
import type { Vec2 } from "../../core/transform";

export type { Vec2 };

export const GEOMETRY_EPSILON = 1e-8;

export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];

export const subtract = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];

export const scale = (vector: Vec2, scalar: number): Vec2 => [
  vector[0] * scalar,
  vector[1] * scalar,
];

export const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];

export const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];

export const lengthSquared = (vector: Vec2) => dot(vector, vector);

export const normalize = (vector: Vec2, fallback: Vec2 = [1, 0]): Vec2 => {
  const magnitudeSquared = lengthSquared(vector);
  if (magnitudeSquared <= GEOMETRY_EPSILON * GEOMETRY_EPSILON) {
    return [...fallback];
  }
  const inverseMagnitude = 1 / Math.sqrt(magnitudeSquared);
  return scale(vector, inverseMagnitude);
};

export const closestPointOnSegment = (
  point: Vec2,
  start: Vec2,
  end: Vec2
): Vec2 => {
  const edge = subtract(end, start);
  const edgeLengthSquared = lengthSquared(edge);
  if (edgeLengthSquared <= GEOMETRY_EPSILON * GEOMETRY_EPSILON) {
    return [...start];
  }
  const parameter = Math.max(
    0,
    Math.min(1, dot(subtract(point, start), edge) / edgeLengthSquared)
  );
  return add(start, scale(edge, parameter));
};

export const signedArea = (vertices: readonly Vec2[]) => {
  let doubleArea = 0;
  for (let i = 0; i < vertices.length; i++) {
    doubleArea += cross(vertices[i], vertices[(i + 1) % vertices.length]);
  }
  return doubleArea / 2;
};

export const assertValidConvexPolygon = (
  polygon: BoundingConvexPolygon
): void => {
  const { vertices } = polygon;
  if (vertices.length < 3) {
    throw new Error("A convex polygon collider requires at least 3 vertices");
  }
  for (const vertex of vertices) {
    if (!Number.isFinite(vertex[0]) || !Number.isFinite(vertex[1])) {
      throw new Error("Convex polygon vertices must be finite");
    }
  }

  const area = signedArea(vertices);
  if (Math.abs(area) <= GEOMETRY_EPSILON) {
    throw new Error("A convex polygon collider must have non-zero area");
  }

  const expectedTurn = Math.sign(area);
  for (let i = 0; i < vertices.length; i++) {
    const previous = vertices[i];
    const current = vertices[(i + 1) % vertices.length];
    const next = vertices[(i + 2) % vertices.length];
    const edge = subtract(current, previous);
    if (lengthSquared(edge) <= GEOMETRY_EPSILON * GEOMETRY_EPSILON) {
      throw new Error(
        "A convex polygon collider cannot contain duplicate vertices"
      );
    }
    const turn = cross(edge, subtract(next, current));
    if (Math.abs(turn) <= GEOMETRY_EPSILON) {
      throw new Error(
        "A convex polygon collider cannot contain collinear edges"
      );
    }
    if (Math.sign(turn) !== expectedTurn) {
      throw new Error("Polygon collider vertices must form a convex polygon");
    }
  }
};
