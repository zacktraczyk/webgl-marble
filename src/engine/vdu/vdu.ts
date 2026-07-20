import { mat3 } from "gl-matrix";
import { Camera2D } from "../camera/camera2d";
import type { EntityId } from "../core/entity";
import { createTransform, type Transform } from "../core/transform";
import { DrawEntity, type MeshBuffer } from "./entity";
import {
  circleMesh,
  polygonMesh,
  rectangleMesh,
  rightTriangleMesh,
} from "./meshes";
import type {
  RenderComponentDefinition,
  RenderPartDefinition,
  RenderPrimitive,
} from "./component";
import { createPipeline, type Pipeline } from "./pipeline";
import fragShader from "./glsl/frag.glsl";
import vertShader from "./glsl/vert.glsl";

/**
 * Visual Display Unit — WebGL renderer for World-owned entity components.
 *
 * Owns the GL context, the single shader pipeline, and the mesh-buffer cache.
 * Draw entities are thin transform/color records that reference cached buffers.
 */
export class VDU {
  readonly canvas: HTMLCanvasElement;
  private readonly _gl: WebGLRenderingContext;
  private readonly _pipeline: Pipeline;
  private _drawEntities: DrawEntity[];
  readonly camera: Camera2D;
  private readonly _meshBuffers = new Map<string, MeshBuffer>();

  private _drawMode: "TRIANGLES" | "LINES" = "TRIANGLES";

  constructor(
    canvasParam: HTMLCanvasElement | string,
    camera: Camera2D = new Camera2D()
  ) {
    // Get canvas element
    let canvas: HTMLCanvasElement;
    if (typeof canvasParam === "string") {
      const canvasElement = document.querySelector(canvasParam);
      if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement)) {
        throw new Error("Failed to get canvas element");
      }
      canvas = canvasElement;
    } else {
      canvas = canvasParam;
    }
    this.canvas = canvas;

    // Get WebGL rendering context
    const gl = canvas.getContext("webgl", { antialias: true, depth: false });
    if (!gl) {
      throw new Error(
        "Unable to initialize WebGL. Your browser may not support it."
      );
    }
    this._gl = gl;

    this._pipeline = createPipeline(gl, vertShader, fragShader);
    this._drawEntities = [];
    this.camera = camera;
  }

  private _cleanup() {
    this._drawEntities = this._drawEntities.filter(
      (entity) => !entity.markedForDeletion
    );
  }

  set drawMode(mode: "TRIANGLES" | "LINES") {
    this._drawMode = mode;
  }

  get drawMode() {
    return this._drawMode;
  }

  addEntity(
    ownerId: EntityId,
    transform: Transform,
    renderable: RenderComponentDefinition
  ) {
    for (const part of renderable.parts) {
      const mesh = this._resolveMesh(part);
      const local = createTransform(
        part.localTransform ?? { position: [0, 0] }
      );
      const entity = new DrawEntity({
        mesh,
        position: local.position,
        rotation: local.rotation,
        scale: local.scale,
        color: part.color,
      });
      entity.attachToEntity(ownerId, transform);
      this._drawEntities.push(entity);
    }
  }

  removeEntity(ownerId: EntityId) {
    for (const entity of this._drawEntities) {
      if (entity.ownerId === ownerId) {
        entity.delete();
      }
    }
  }

  /**
   * Returns the cached mesh buffer for a part, uploading it once on first use.
   * The cache key dedupes identical geometry so repeated primitives share one
   * GPU buffer.
   */
  private _resolveMesh(part: RenderPartDefinition): MeshBuffer {
    const key = this._meshKey(part);
    const cached = this._meshBuffers.get(key);
    if (cached) {
      return cached;
    }
    const vertices = this._generateMesh(part.primitive);
    const mesh = this._createMeshBuffer(vertices);
    this._meshBuffers.set(key, mesh);
    return mesh;
  }

  private _createMeshBuffer(vertices: Float32Array): MeshBuffer {
    const gl = this._gl;
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error("Failed to create buffer");
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    return { buffer, vertexCount: vertices.length / 2 };
  }

  private _generateMesh(primitive: RenderPrimitive): Float32Array {
    switch (primitive.type) {
      case "circle":
        return circleMesh(primitive.radius);
      case "rectangle":
        return rectangleMesh(primitive.width, primitive.height);
      case "right-triangle":
        return rightTriangleMesh(primitive.width, primitive.height);
      case "polygon":
        return polygonMesh(primitive.vertices);
    }
  }

  private _meshKey(part: RenderPartDefinition) {
    const primitive = part.primitive;
    switch (primitive.type) {
      case "circle":
        return `circle:${primitive.radius}`;
      case "rectangle":
        return `rectangle:${primitive.width}:${primitive.height}`;
      case "right-triangle":
        return `right-triangle:${primitive.width}:${primitive.height}`;
      case "polygon":
        return `polygon:${primitive.vertices.flat().join(":")}`;
    }
  }

  render() {
    const gl = this._gl;
    const canvas = gl.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Failed to get canvas element");
    }

    this._resizeToDisplaySize(canvas, window.devicePixelRatio || 1);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // 2D parts are ordered by submission. Alpha blending supports highlights,
    // shadows, and other local render parts on the same entity, so draw order
    // must follow submission order.
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const pipeline = this._pipeline;
    gl.useProgram(pipeline.program);
    // uResolution is identical for every entity, so set it once per frame.
    gl.uniform2f(pipeline.uResolution, canvas.clientWidth, canvas.clientHeight);

    const cameraMatrix = this.camera.matrix();

    this._cleanup();

    let lastBuffer: WebGLBuffer | undefined = undefined;
    for (const entity of this._drawEntities) {
      const mesh = entity.mesh;

      // Bind + point the attribute only when the buffer changes.
      if (mesh.buffer !== lastBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
        gl.enableVertexAttribArray(pipeline.aVertexPosition);
        gl.vertexAttribPointer(
          pipeline.aVertexPosition,
          2,
          gl.FLOAT,
          false,
          0,
          0
        );
        lastBuffer = mesh.buffer;
      }

      entity.computeMatrix();
      mat3.multiply(entity.matrix, cameraMatrix, entity.matrix);
      gl.uniformMatrix3fv(pipeline.uMatrix, false, entity.matrix);
      gl.uniform4fv(pipeline.uColor, entity.color);

      if (this._drawMode === "LINES") {
        gl.drawArrays(gl.LINE_LOOP, 0, mesh.vertexCount);
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
      }
    }
  }

  /**
   * Resizes the canvas's drawing buffer to match its displayed size.
   * @param canvas the render target
   * @param multiplier device-pixel scale to apply (e.g. devicePixelRatio)
   */
  private _resizeToDisplaySize(canvas: HTMLCanvasElement, multiplier: number) {
    const width = Math.round(canvas.clientWidth * multiplier);
    const height = Math.round(canvas.clientHeight * multiplier);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  dispose() {
    for (const mesh of this._meshBuffers.values()) {
      this._gl.deleteBuffer(mesh.buffer);
    }
    this._drawEntities = [];
    this._meshBuffers.clear();
    this._gl.deleteProgram(this._pipeline.program);
  }
}
