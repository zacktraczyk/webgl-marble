import {
  createCollision,
  type Collision,
  type ContactManifold,
  type ContactPoint,
  type Line,
  type NarrowPhase,
} from "../types";
import type {
  BoundingCircle,
  BoundingConvexPolygon,
  PhysicsEntity,
} from "../../entity";
import {
  GEOMETRY_EPSILON,
  add,
  assertValidConvexPolygon,
  closestPointOnSegment,
  dot,
  lengthSquared,
  normalize,
  scale,
  signedArea,
  subtract,
  type Vec2,
} from "../geometry";

type WorldPolygon = {
  vertices: Vec2[];
  outwardNormals: Vec2[];
};

type PolygonContact = {
  manifold: ContactManifold;
  edge: Line | null;
};

type ClipVertex = {
  point: Vec2;
  feature: string;
};

/**
 * Production narrow phase for circles and convex polygons.
 *
 * Polygon pairs use SAT to select a reference face, then clip the incident
 * edge to produce a stable one- or two-point contact manifold.
 */
export class SATNarrowPhase implements NarrowPhase {
  private readonly _validatedPolygons = new WeakSet<BoundingConvexPolygon>();

  detectCollision(
    entity1: PhysicsEntity,
    entity2: PhysicsEntity
  ): Collision | null {
    const shape1 = entity1.boundingShape;
    const shape2 = entity2.boundingShape;
    if (!shape1 || !shape2) {
      return null;
    }

    if (shape1.type === "BoundingCircle") {
      this._assertValidCircle(shape1);
      if (shape2.type === "BoundingCircle") {
        this._assertValidCircle(shape2);
        const manifold = this._circleCircle(entity1, shape1, entity2, shape2);
        return manifold
          ? createCollision({ entity1, entity2, manifold })
          : null;
      }

      const polygon2 = this._worldPolygon(entity2, shape2);
      const result = this._polygonCircle(polygon2, shape1, entity1);
      if (!result) {
        return null;
      }
      const manifold: ContactManifold = {
        ...result.manifold,
        normal: scale(result.manifold.normal, -1),
      };
      return createCollision({
        entity1,
        entity2,
        manifold,
        diagnostics: { referenceEdge: result.edge ?? undefined },
      });
    }

    const polygon1 = this._worldPolygon(entity1, shape1);
    if (shape2.type === "BoundingCircle") {
      this._assertValidCircle(shape2);
      const result = this._polygonCircle(polygon1, shape2, entity2);
      return result
        ? createCollision({
            entity1,
            entity2,
            manifold: result.manifold,
            diagnostics: { referenceEdge: result.edge ?? undefined },
          })
        : null;
    }

    const polygon2 = this._worldPolygon(entity2, shape2);
    const result = this._polygonPolygon(polygon1, polygon2);
    return result
      ? createCollision({
          entity1,
          entity2,
          manifold: result.manifold,
          diagnostics: { referenceEdge: result.edge ?? undefined },
        })
      : null;
  }

  private _circleCircle(
    entity1: PhysicsEntity,
    circle1: BoundingCircle,
    entity2: PhysicsEntity,
    circle2: BoundingCircle
  ): ContactManifold | null {
    const delta = subtract(entity2.position, entity1.position);
    const distanceSquared = lengthSquared(delta);
    const combinedRadius = circle1.radius + circle2.radius;
    if (
      distanceSquared >
      (combinedRadius + GEOMETRY_EPSILON) * (combinedRadius + GEOMETRY_EPSILON)
    ) {
      return null;
    }

    const distance = Math.sqrt(distanceSquared);
    const fallback = normalize(
      subtract(entity2.velocity, entity1.velocity),
      [1, 0]
    );
    const normal = normalize(delta, fallback);
    const pointOn1 = add(entity1.position, scale(normal, circle1.radius));
    const pointOn2 = subtract(entity2.position, scale(normal, circle2.radius));
    const separation = distance - combinedRadius;

    return {
      normal,
      penetrationDepth: Math.max(0, -separation),
      points: [
        {
          position: scale(add(pointOn1, pointOn2), 0.5),
          separation,
          featureId: "circle-circle",
        },
      ],
    };
  }

  /** Returns a manifold whose normal points from polygon toward circle. */
  private _polygonCircle(
    polygon: WorldPolygon,
    circle: BoundingCircle,
    circleEntity: PhysicsEntity
  ): PolygonContact | null {
    const center = circleEntity.position;
    let inside = true;
    let closestPoint: Vec2 = polygon.vertices[0];
    let closestEdgeIndex = 0;
    let closestDistanceSquared = Infinity;

    for (let i = 0; i < polygon.vertices.length; i++) {
      const start = polygon.vertices[i];
      const end = polygon.vertices[(i + 1) % polygon.vertices.length];
      if (
        dot(polygon.outwardNormals[i], subtract(center, start)) >
        GEOMETRY_EPSILON
      ) {
        inside = false;
      }

      const candidate = closestPointOnSegment(center, start, end);
      const distanceSquared = lengthSquared(subtract(center, candidate));
      if (distanceSquared < closestDistanceSquared) {
        closestDistanceSquared = distanceSquared;
        closestPoint = candidate;
        closestEdgeIndex = i;
      }
    }

    const radiusWithTolerance = circle.radius + GEOMETRY_EPSILON;
    if (!inside && closestDistanceSquared > radiusWithTolerance ** 2) {
      return null;
    }

    const distance = Math.sqrt(closestDistanceSquared);
    let normal: Vec2;
    if (distance <= GEOMETRY_EPSILON) {
      normal = polygon.outwardNormals[closestEdgeIndex];
    } else if (inside) {
      normal = scale(subtract(closestPoint, center), 1 / distance);
    } else {
      normal = scale(subtract(center, closestPoint), 1 / distance);
    }

    const separation = inside
      ? -(distance + circle.radius)
      : distance - circle.radius;
    const pointOnCircle = inside
      ? add(center, scale(normal, circle.radius))
      : subtract(center, scale(normal, circle.radius));
    const contactPoint: ContactPoint = {
      position: scale(add(closestPoint, pointOnCircle), 0.5),
      separation,
      featureId: `polygon-circle:${closestEdgeIndex}:${inside ? "inside" : "outside"}`,
    };

    return {
      edge: [
        polygon.vertices[closestEdgeIndex],
        polygon.vertices[(closestEdgeIndex + 1) % polygon.vertices.length],
      ],
      manifold: {
        normal,
        penetrationDepth: Math.max(0, -separation),
        points: [contactPoint],
      },
    };
  }

  private _polygonPolygon(
    polygon1: WorldPolygon,
    polygon2: WorldPolygon
  ): PolygonContact | null {
    const separation1 = this._findMaximumSeparation(polygon1, polygon2);
    if (separation1.separation > GEOMETRY_EPSILON) {
      return null;
    }
    const separation2 = this._findMaximumSeparation(polygon2, polygon1);
    if (separation2.separation > GEOMETRY_EPSILON) {
      return null;
    }

    const referenceIsPolygon2 =
      separation2.separation > separation1.separation + GEOMETRY_EPSILON;
    const reference = referenceIsPolygon2 ? polygon2 : polygon1;
    const incident = referenceIsPolygon2 ? polygon1 : polygon2;
    const referenceEdgeIndex = referenceIsPolygon2
      ? separation2.edgeIndex
      : separation1.edgeIndex;
    const referenceNormal = reference.outwardNormals[referenceEdgeIndex];
    const referenceStart = reference.vertices[referenceEdgeIndex];
    const referenceEnd =
      reference.vertices[(referenceEdgeIndex + 1) % reference.vertices.length];
    const incidentEdgeIndex = this._findIncidentEdge(incident, referenceNormal);
    const incidentStart = incident.vertices[incidentEdgeIndex];
    const incidentEnd =
      incident.vertices[(incidentEdgeIndex + 1) % incident.vertices.length];

    const tangent = normalize(subtract(referenceEnd, referenceStart));
    let clipped: ClipVertex[] = [
      { point: incidentStart, feature: `${incidentEdgeIndex}:0` },
      { point: incidentEnd, feature: `${incidentEdgeIndex}:1` },
    ];
    clipped = this._clipSegment(
      clipped,
      scale(tangent, -1),
      dot(scale(tangent, -1), referenceStart),
      "start"
    );
    clipped = this._clipSegment(
      clipped,
      tangent,
      dot(tangent, referenceEnd),
      "end"
    );

    const points: ContactPoint[] = [];
    for (const clippedVertex of clipped) {
      const separation = dot(
        referenceNormal,
        subtract(clippedVertex.point, referenceStart)
      );
      if (separation <= GEOMETRY_EPSILON) {
        points.push({
          position: subtract(
            clippedVertex.point,
            scale(referenceNormal, separation * 0.5)
          ),
          separation,
          featureId: `${referenceIsPolygon2 ? "B" : "A"}:${referenceEdgeIndex}:${clippedVertex.feature}`,
        });
      }
    }

    if (points.length === 0) {
      const incidentPoint = this._supportPoint(
        incident.vertices,
        scale(referenceNormal, -1)
      );
      const separation = dot(
        referenceNormal,
        subtract(incidentPoint, referenceStart)
      );
      points.push({
        position: subtract(
          incidentPoint,
          scale(referenceNormal, separation * 0.5)
        ),
        separation,
        featureId: `${referenceIsPolygon2 ? "B" : "A"}:${referenceEdgeIndex}:fallback`,
      });
    }

    const deepestSeparation = Math.min(
      ...points.map((point) => point.separation)
    );
    const normal = referenceIsPolygon2
      ? scale(referenceNormal, -1)
      : referenceNormal;

    return {
      edge: [referenceStart, referenceEnd],
      manifold: {
        normal,
        penetrationDepth: Math.max(0, -deepestSeparation),
        points,
      },
    };
  }

  private _findMaximumSeparation(
    reference: WorldPolygon,
    incident: WorldPolygon
  ) {
    let maximumSeparation = -Infinity;
    let edgeIndex = 0;
    for (let i = 0; i < reference.vertices.length; i++) {
      const normal = reference.outwardNormals[i];
      const origin = reference.vertices[i];
      let minimumIncidentSeparation = Infinity;
      for (const vertex of incident.vertices) {
        minimumIncidentSeparation = Math.min(
          minimumIncidentSeparation,
          dot(normal, subtract(vertex, origin))
        );
      }
      if (minimumIncidentSeparation > maximumSeparation) {
        maximumSeparation = minimumIncidentSeparation;
        edgeIndex = i;
      }
    }
    return { separation: maximumSeparation, edgeIndex };
  }

  private _findIncidentEdge(polygon: WorldPolygon, normal: Vec2) {
    let edgeIndex = 0;
    let minimumDot = Infinity;
    for (let i = 0; i < polygon.outwardNormals.length; i++) {
      const alignment = dot(normal, polygon.outwardNormals[i]);
      if (alignment < minimumDot) {
        minimumDot = alignment;
        edgeIndex = i;
      }
    }
    return edgeIndex;
  }

  private _clipSegment(
    vertices: ClipVertex[],
    normal: Vec2,
    offset: number,
    planeFeature: string
  ): ClipVertex[] {
    if (vertices.length < 2) {
      return vertices;
    }
    const distance1 = dot(normal, vertices[0].point) - offset;
    const distance2 = dot(normal, vertices[1].point) - offset;
    const output: ClipVertex[] = [];
    if (distance1 <= GEOMETRY_EPSILON) {
      output.push(vertices[0]);
    }
    if (distance2 <= GEOMETRY_EPSILON) {
      output.push(vertices[1]);
    }
    if (distance1 * distance2 < -(GEOMETRY_EPSILON ** 2)) {
      const parameter = distance1 / (distance1 - distance2);
      output.push({
        point: add(
          vertices[0].point,
          scale(subtract(vertices[1].point, vertices[0].point), parameter)
        ),
        feature: `${planeFeature}:${distance1 > 0 ? vertices[0].feature : vertices[1].feature}`,
      });
    }
    return output.slice(0, 2);
  }

  private _supportPoint(vertices: Vec2[], direction: Vec2) {
    let result = vertices[0];
    let maximumProjection = dot(result, direction);
    for (let i = 1; i < vertices.length; i++) {
      const projection = dot(vertices[i], direction);
      if (projection > maximumProjection) {
        maximumProjection = projection;
        result = vertices[i];
      }
    }
    return result;
  }

  private _worldPolygon(
    entity: PhysicsEntity,
    polygon: BoundingConvexPolygon
  ): WorldPolygon {
    if (!this._validatedPolygons.has(polygon)) {
      assertValidConvexPolygon(polygon);
      this._validatedPolygons.add(polygon);
    }

    const cosine = Math.cos(entity.rotation);
    const sine = Math.sin(entity.rotation);
    const vertices = polygon.vertices.map(
      ([x, y]): Vec2 => [
        x * cosine - y * sine + entity.position[0],
        x * sine + y * cosine + entity.position[1],
      ]
    );
    const winding = Math.sign(signedArea(vertices));
    const outwardNormals = vertices.map((vertex, index): Vec2 => {
      const next = vertices[(index + 1) % vertices.length];
      const edge = subtract(next, vertex);
      return winding > 0
        ? normalize([edge[1], -edge[0]])
        : normalize([-edge[1], edge[0]]);
    });
    return { vertices, outwardNormals };
  }

  private _assertValidCircle(circle: BoundingCircle) {
    if (!Number.isFinite(circle.radius) || circle.radius <= 0) {
      throw new Error("A circle collider requires a finite positive radius");
    }
  }
}
