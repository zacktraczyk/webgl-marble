import type { BoundingConvexPolygon } from "../entity";
import type { Vec2 } from "../../core/transform";

export type { Vec2 };

export const GEOMETRY_EPSILON = 1e-8;

/** Adds two 2D vectors component-wise. */
export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];

/** Subtracts `b` from `a` component-wise. */
export const subtract = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];

/** Scales a 2D vector by a scalar. */
export const scale = (vector: Vec2, scalar: number): Vec2 => [
  vector[0] * scalar,
  vector[1] * scalar,
];

/** Dot product of two 2D vectors (a scalar). */
export const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];

/**
 * 2D cross product: the z-component of the 3D cross product, a scalar.
 * Sign encodes the turn direction from `a` to `b`.
 */
export const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];

/** Squared magnitude of a 2D vector; avoids the square root of `length`. */
export const lengthSquared = (vector: Vec2) => dot(vector, vector);

/**
 * Returns the unit-length version of a 2D vector.
 * @param vector vector to normalize
 * @param fallback copied and returned when `vector` is at or near zero length
 * @returns a vector of length 1, or a copy of `fallback`
 */
export const normalize = (vector: Vec2, fallback: Vec2 = [1, 0]): Vec2 => {
  const magnitudeSquared = lengthSquared(vector);
  if (magnitudeSquared <= GEOMETRY_EPSILON * GEOMETRY_EPSILON) {
    return [...fallback];
  }
  const inverseMagnitude = 1 / Math.sqrt(magnitudeSquared);
  return scale(vector, inverseMagnitude);
};

/**
 * Rotates each local vertex by `rotation` and translates it by `position`.
 * @param vertices local-space vertices
 * @param position world-space translation applied after rotation
 * @param rotation rotation in radians
 * @returns the vertices in world space
 */
export const transformVertices = (
  vertices: readonly Vec2[],
  position: Vec2,
  rotation: number
): Vec2[] => {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return vertices.map(([x, y]): Vec2 => [
    x * cosine - y * sine + position[0],
    x * sine + y * cosine + position[1],
  ]);
};

/**
 * Finds the point on segment `start`–`end` nearest to `point`.
 * @param point query point
 * @param start segment start
 * @param end segment end
 * @returns the nearest point, clamped to the segment's endpoints
 */
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

/**
 * Signed area of the polygon described by `vertices` (shoelace formula).
 * @param vertices ordered polygon vertices
 * @returns the signed area; its sign indicates the winding direction
 */
export const signedArea = (vertices: readonly Vec2[]) => {
  let doubleArea = 0;
  for (let i = 0; i < vertices.length; i++) {
    doubleArea += cross(vertices[i], vertices[(i + 1) % vertices.length]);
  }
  return doubleArea / 2;
};

/**
 * Validates that a collider's vertices form a non-degenerate convex polygon.
 * @param polygon polygon collider to check
 * @throws if there are fewer than 3 vertices, any non-finite, duplicate, or
 * collinear vertices, zero area, or a non-convex (reflex) turn
 */
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
