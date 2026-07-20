import type { Vec2 } from "../core/transform";

/**
 * Pure vertex generators for the renderer's primitives. Each returns a flat
 * Float32Array of a triangle list — pairs of `x, y` in local model space,
 * centred on the origin — ready to upload straight into a GL buffer.
 */

/**
 * Generates a filled circle as a 32-triangle fan.
 * @param radius circle radius in model-space units
 * @returns triangle-list vertices (x, y pairs)
 */
export function circleMesh(radius: number): Float32Array {
  const segments = 32;
  const thetaStart = 0;
  const thetaLength = 2 * Math.PI;

  const vertices: number[] = [];
  for (let s = 0; s <= segments - 1; s++) {
    const segment = thetaStart + (s / segments) * thetaLength;
    const nextSegment = thetaStart + ((s - 1) / segments) * thetaLength;

    vertices.push(0, 0);
    vertices.push(radius * Math.cos(segment), radius * Math.sin(segment));
    vertices.push(
      radius * Math.cos(nextSegment),
      radius * Math.sin(nextSegment)
    );
  }

  return new Float32Array(vertices);
}

/**
 * Generates an axis-aligned rectangle as two triangles.
 * @param width rectangle width in model-space units
 * @param height rectangle height in model-space units
 * @returns triangle-list vertices (x, y pairs)
 */
export function rectangleMesh(width: number, height: number): Float32Array {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return new Float32Array([
    halfWidth,
    -halfHeight,
    -halfWidth,
    -halfHeight,
    halfWidth,
    halfHeight,

    -halfWidth,
    -halfHeight,
    -halfWidth,
    halfHeight,
    halfWidth,
    halfHeight,
  ]);
}

/**
 * Generates a right triangle centred on the origin.
 * @param width triangle width in model-space units
 * @param height triangle height in model-space units
 * @returns triangle-list vertices (x, y pairs)
 */
export function rightTriangleMesh(width: number, height: number): Float32Array {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return new Float32Array([
    -halfWidth,
    -halfHeight,
    halfWidth,
    halfHeight,
    -halfWidth,
    halfHeight,
  ]);
}

/**
 * Triangulates a convex polygon with a triangle fan anchored at the first
 * vertex.
 * @param vertices the polygon's corner points, in order (at least 3)
 * @returns triangle-list vertices (x, y pairs)
 * @throws if fewer than three vertices are supplied
 */
export function polygonMesh(vertices: readonly Vec2[]): Float32Array {
  if (vertices.length < 3) {
    throw new Error("A render polygon requires at least three vertices");
  }

  const out: number[] = [];
  for (let index = 1; index < vertices.length - 1; index++) {
    out.push(
      vertices[0][0],
      vertices[0][1],
      vertices[index][0],
      vertices[index][1],
      vertices[index + 1][0],
      vertices[index + 1][1]
    );
  }

  return new Float32Array(out);
}
