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
import {
  createInstancedPipeline,
  createPipeline,
  type InstancedPipeline,
  type Pipeline,
} from "./pipeline";
import fragShader from "./glsl/frag.glsl";
import vertShader from "./glsl/vert.glsl";
import instancedFragShader from "./glsl/instanced.frag.glsl";
import instancedVertShader from "./glsl/instanced.vert.glsl";

/**
 * Per-instance record layout for the instanced path: two affine matrix rows
 * (`aMatX`, `aMatY`) followed by an RGBA color — 10 floats, 40-byte stride.
 */
const FLOATS_PER_INSTANCE = 10;
const INSTANCE_STRIDE = FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT;

/** Selects the draw path used by the VDU. `auto` preserves production behavior. */
export type VDURenderStrategy = "auto" | "basic" | "instanced";

export interface VDUOptions {
  renderStrategy?: VDURenderStrategy;
}

/** JSON-safe capability data used by diagnostics and the benchmark harness. */
export interface VDURenderMetadata {
  requestedStrategy: VDURenderStrategy;
  activeStrategy: "basic" | "instanced" | "unsupported";
  drawMode: "TRIANGLES" | "LINES";
  instancingSupported: boolean;
}

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

  // Instanced-draw state — populated only when ANGLE_instanced_arrays exists.
  private readonly _instanced: ANGLE_instanced_arrays | null;
  private readonly _instancedPipeline: InstancedPipeline | null;
  private readonly _instanceBuffer: WebGLBuffer | null = null;
  private readonly _renderStrategy: VDURenderStrategy;
  /** Persistent, geometrically grown per-instance staging array. */
  private _instanceData = new Float32Array(0);
  /** Which attribute set is currently enabled, to skip redundant calls. */
  private _attribMode: "none" | "basic" | "instanced" = "none";
  /** Last program used and resolution uploaded, to set uResolution lazily. */
  private _lastProgram: WebGLProgram | null = null;
  private _lastResWidth = -1;
  private _lastResHeight = -1;

  constructor(
    canvasParam: HTMLCanvasElement | string,
    camera: Camera2D = new Camera2D(),
    { renderStrategy = "auto" }: VDUOptions = {}
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
    this._renderStrategy = renderStrategy;

    this._pipeline = createPipeline(gl, vertShader, fragShader);

    // Instanced rendering is optional: fall back to the per-entity draw loop
    // when the WebGL1 extension is unavailable.
    this._instanced = gl.getExtension("ANGLE_instanced_arrays");
    if (this._instanced) {
      this._instancedPipeline = createInstancedPipeline(
        gl,
        instancedVertShader,
        instancedFragShader
      );
      this._instanceBuffer = gl.createBuffer();
      if (!this._instanceBuffer) {
        throw new Error("Failed to create instance buffer");
      }
    } else {
      this._instancedPipeline = null;
    }

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

  /** Requested draw path. The value is immutable for the VDU's lifetime. */
  get renderStrategy() {
    return this._renderStrategy;
  }

  /** Reports the path that the next render will use without exposing GL state. */
  get renderMetadata(): VDURenderMetadata {
    let activeStrategy: VDURenderMetadata["activeStrategy"] = "basic";
    if (this._drawMode === "TRIANGLES" && this._renderStrategy !== "basic") {
      activeStrategy = this._instanced ? "instanced" : "basic";
      if (this._renderStrategy === "instanced" && !this._instanced) {
        activeStrategy = "unsupported";
      }
    }
    return {
      requestedStrategy: this._renderStrategy,
      activeStrategy,
      drawMode: this._drawMode,
      instancingSupported: this._instanced !== null,
    };
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
    // Depth is disabled and the context has no depth buffer, so only clear color.
    gl.clear(gl.COLOR_BUFFER_BIT);

    const cameraMatrix = this.camera.matrix();

    this._cleanup();

    if (
      this._drawMode === "TRIANGLES" &&
      this._renderStrategy === "instanced" &&
      !this._instanced
    ) {
      throw new Error(
        "The instanced VDU render strategy requires ANGLE_instanced_arrays"
      );
    }

    // Instancing only serves TRIANGLES; LINES demos stay on the per-entity path.
    if (
      this._drawMode === "TRIANGLES" &&
      this._renderStrategy !== "basic" &&
      this._instanced
    ) {
      this._renderInstanced(canvas, cameraMatrix);
    } else {
      this._renderBasic(canvas, cameraMatrix);
    }
  }

  /**
   * Uploads `uResolution` for a program only when the canvas size changed since
   * the last upload for that same program (a per-program uniform is reset when
   * the program is swapped, so a program change also forces a re-upload).
   */
  private _setResolution(
    location: WebGLUniformLocation,
    program: WebGLProgram,
    canvas: HTMLCanvasElement
  ) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (
      program === this._lastProgram &&
      width === this._lastResWidth &&
      height === this._lastResHeight
    ) {
      return;
    }
    this._gl.uniform2f(location, width, height);
    this._lastResWidth = width;
    this._lastResHeight = height;
  }

  /** Per-entity draw loop. Used for LINES mode and when instancing is absent. */
  private _renderBasic(canvas: HTMLCanvasElement, cameraMatrix: mat3) {
    const gl = this._gl;
    const pipeline = this._pipeline;
    gl.useProgram(pipeline.program);
    this._setResolution(pipeline.uResolution, pipeline.program, canvas);
    this._lastProgram = pipeline.program;

    // Enable the vertex attribute once; the pointer is re-bound per buffer.
    if (this._attribMode !== "basic") {
      this._disableInstancedAttribs();
      gl.enableVertexAttribArray(pipeline.aVertexPosition);
      this._attribMode = "basic";
    }

    const mode = this._drawMode === "LINES" ? gl.LINE_LOOP : gl.TRIANGLES;
    let lastBuffer: WebGLBuffer | undefined = undefined;
    for (const entity of this._drawEntities) {
      const mesh = entity.mesh;

      // Bind + point the attribute only when the buffer changes.
      if (mesh.buffer !== lastBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
        gl.vertexAttribPointer(pipeline.aVertexPosition, 2, gl.FLOAT, false, 0, 0);
        lastBuffer = mesh.buffer;
      }

      entity.computeMatrix();
      mat3.multiply(entity.matrix, cameraMatrix, entity.matrix);
      gl.uniformMatrix3fv(pipeline.uMatrix, false, entity.matrix);
      gl.uniform4fv(pipeline.uColor, entity.color);

      gl.drawArrays(mode, 0, mesh.vertexCount);
    }
  }

  /**
   * Batched draw loop using `ANGLE_instanced_arrays`. Entities are grouped into
   * maximal *contiguous* runs that share a mesh buffer and each run draws in one
   * `drawArraysInstancedANGLE` call. Batching only contiguous runs (never a
   * global sort by mesh) keeps submission order intact, so alpha-blended overlap
   * between successive parts renders exactly as the per-entity path would.
   */
  private _renderInstanced(canvas: HTMLCanvasElement, cameraMatrix: mat3) {
    const gl = this._gl;
    const ext = this._instanced!;
    const pipeline = this._instancedPipeline!;
    gl.useProgram(pipeline.program);
    this._setResolution(pipeline.uResolution, pipeline.program, canvas);
    this._lastProgram = pipeline.program;

    // Enable the vertex + per-instance attribute arrays and set divisors once.
    if (this._attribMode !== "instanced") {
      gl.enableVertexAttribArray(pipeline.aVertexPosition);
      gl.enableVertexAttribArray(pipeline.aMatX);
      gl.enableVertexAttribArray(pipeline.aMatY);
      gl.enableVertexAttribArray(pipeline.aColor);
      ext.vertexAttribDivisorANGLE(pipeline.aVertexPosition, 0);
      ext.vertexAttribDivisorANGLE(pipeline.aMatX, 1);
      ext.vertexAttribDivisorANGLE(pipeline.aMatY, 1);
      ext.vertexAttribDivisorANGLE(pipeline.aColor, 1);
      this._attribMode = "instanced";
    }

    const entities = this._drawEntities;
    let start = 0;
    while (start < entities.length) {
      const mesh = entities[start].mesh;
      // Extend the run over every following entity sharing this mesh buffer.
      let end = start + 1;
      while (end < entities.length && entities[end].mesh.buffer === mesh.buffer) {
        end++;
      }

      const runLength = end - start;
      this._ensureInstanceCapacity(runLength);
      const data = this._instanceData;
      let offset = 0;
      for (let index = start; index < end; index++) {
        const entity = entities[index];
        entity.computeMatrix();
        mat3.multiply(entity.matrix, cameraMatrix, entity.matrix);
        const matrix = entity.matrix;
        // Pack the two affine output rows: x = m0,m3,m6 · [x,y,1], y = m1,m4,m7.
        data[offset] = matrix[0];
        data[offset + 1] = matrix[3];
        data[offset + 2] = matrix[6];
        data[offset + 3] = matrix[1];
        data[offset + 4] = matrix[4];
        data[offset + 5] = matrix[7];
        const color = entity.color;
        data[offset + 6] = color[0];
        data[offset + 7] = color[1];
        data[offset + 8] = color[2];
        data[offset + 9] = color[3];
        offset += FLOATS_PER_INSTANCE;
      }

      // Shared mesh geometry.
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      gl.vertexAttribPointer(pipeline.aVertexPosition, 2, gl.FLOAT, false, 0, 0);

      // Per-instance transform + color.
      gl.bindBuffer(gl.ARRAY_BUFFER, this._instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, offset));
      gl.vertexAttribPointer(pipeline.aMatX, 3, gl.FLOAT, false, INSTANCE_STRIDE, 0);
      gl.vertexAttribPointer(pipeline.aMatY, 3, gl.FLOAT, false, INSTANCE_STRIDE, 12);
      gl.vertexAttribPointer(pipeline.aColor, 4, gl.FLOAT, false, INSTANCE_STRIDE, 24);

      ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, mesh.vertexCount, runLength);
      start = end;
    }
  }

  /**
   * Grows the persistent instance-staging array (and reallocates GPU storage)
   * geometrically so it holds at least `instanceCount` records. No-ops once the
   * array is large enough, so steady-state frames allocate nothing.
   * @param instanceCount records that must fit
   */
  private _ensureInstanceCapacity(instanceCount: number) {
    const needed = instanceCount * FLOATS_PER_INSTANCE;
    if (needed <= this._instanceData.length) {
      return;
    }
    let capacity = this._instanceData.length || FLOATS_PER_INSTANCE * 64;
    while (capacity < needed) {
      capacity *= 2;
    }
    this._instanceData = new Float32Array(capacity);
    const gl = this._gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._instanceBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      capacity * Float32Array.BYTES_PER_ELEMENT,
      gl.DYNAMIC_DRAW
    );
  }

  /** Disables the per-instance attribute arrays (leaves `aVertexPosition`). */
  private _disableInstancedAttribs() {
    const pipeline = this._instancedPipeline;
    if (!pipeline) {
      return;
    }
    const gl = this._gl;
    gl.disableVertexAttribArray(pipeline.aMatX);
    gl.disableVertexAttribArray(pipeline.aMatY);
    gl.disableVertexAttribArray(pipeline.aColor);
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
    if (this._instancedPipeline) {
      this._gl.deleteProgram(this._instancedPipeline.program);
    }
    if (this._instanceBuffer) {
      this._gl.deleteBuffer(this._instanceBuffer);
    }
  }
}
