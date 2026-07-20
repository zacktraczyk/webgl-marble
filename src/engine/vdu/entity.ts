import { mat3 } from "gl-matrix";
import type { Color } from "../core/color";
import type { EntityId } from "../core/entity";
import type { Transform, Vec2 } from "../core/transform";
import * as id from "../utils/id";

/**
 * A VDU-owned GPU buffer plus its vertex count. Buffers are cached and shared
 * across entities that draw the same mesh; entities only reference them and
 * never create or delete them.
 */
export interface MeshBuffer {
  buffer: WebGLBuffer;
  vertexCount: number;
}

/**
 * A single drawable part: transform + color + a reference to a shared mesh
 * buffer. Holds no GL state of its own — VDU owns the context, pipeline, and
 * buffers.
 */
export class DrawEntity {
  readonly id;
  ownerId?: EntityId;
  rootTransform?: Transform;

  readonly mesh: MeshBuffer;

  position: Vec2;
  rotation: number; // radians
  scale: Vec2;

  color: Color;

  readonly matrix: mat3;

  markedForDeletion: boolean = false;

  constructor({
    mesh,
    position,
    rotation,
    scale,
    color,
  }: {
    mesh: MeshBuffer;
    position: Vec2;
    rotation: number;
    scale: Vec2;
    color: Color;
  }) {
    this.id = id.getNext();

    this.mesh = mesh;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.color = color;

    this.matrix = mat3.create();
    this.computeMatrix();
  }

  delete() {
    if (this.markedForDeletion) {
      return;
    }
    this.markedForDeletion = true;
  }

  attachToEntity(ownerId: EntityId, rootTransform: Transform) {
    this.ownerId = ownerId;
    this.rootTransform = rootTransform;
  }

  computeMatrix() {
    mat3.identity(this.matrix);
    if (this.rootTransform) {
      mat3.translate(this.matrix, this.matrix, this.rootTransform.position);
      mat3.rotate(this.matrix, this.matrix, this.rootTransform.rotation);
      mat3.scale(this.matrix, this.matrix, this.rootTransform.scale);
    }
    mat3.translate(this.matrix, this.matrix, this.position);
    mat3.rotate(this.matrix, this.matrix, this.rotation);
    mat3.scale(this.matrix, this.matrix, this.scale);
  }
}
