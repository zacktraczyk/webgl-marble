import { mat3 } from "gl-matrix";
import { Camera2D } from "../camera/camera2d";
import type { EntityId } from "../core/entity";
import { createTransform, type Transform } from "../core/transform";
import {
  type BufferInfo,
  type ProgramInfo,
  DrawEntity,
  createCircle,
  createPolygon,
  createRectangle,
  createRightTriangle,
} from "./entity";
import type {
  RenderComponentDefinition,
  RenderPartDefinition,
} from "./component";
import fragShader from "./glsl/frag.glsl";
import vertShader from "./glsl/vert.glsl";
import * as WebglUtils from "./webglUtils";

/**
 * Visual Display Unit — WebGL renderer for World-owned entity components.
 */
export class VDU {
  readonly canvas: HTMLCanvasElement;
  private readonly _gl: WebGLRenderingContext;
  // private readonly _shaderProgram: WebGLProgram;
  private readonly _programInfo: ProgramInfo;
  private _drawEntities: DrawEntity[];
  readonly camera: Camera2D;
  private readonly _meshBuffers = new Map<string, BufferInfo>();

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

    // Init shader
    const shaderProgram = WebglUtils.initShaderProgram(
      gl,
      vertShader,
      fragShader
    );
    if (!shaderProgram) {
      throw new Error("Failed to initialize shader program");
    }

    // Create program info
    const attribSetters = WebglUtils.createAttributeSetters(gl, shaderProgram);
    const uniformSetters = WebglUtils.createUniformSetters(gl, shaderProgram);
    const programInfo: ProgramInfo = {
      program: shaderProgram,
      attributeSetters: attribSetters,
      uniformSetters,
    };
    this._programInfo = programInfo;

    // Init draw objects
    this._drawEntities = [];

    this.camera = camera;
  }

  private _cleanup() {
    const filteredEntities = this._drawEntities.filter((entity) => {
      if (entity.markedForDeletion) {
        entity.dispose();
        return false;
      }
      return true;
    });

    this._drawEntities = filteredEntities;
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
      const entity = this._createPart(part);
      const meshKey = this._meshKey(part);
      const sharedBuffer = this._meshBuffers.get(meshKey);
      if (sharedBuffer) {
        entity.useSharedBuffer(sharedBuffer);
      }
      const local = createTransform(
        part.localTransform ?? { position: [0, 0] }
      );
      entity.position = local.position;
      entity.rotation = local.rotation;
      entity.scale = local.scale;
      entity.color = part.color;
      entity.attachToEntity(ownerId, transform);
      entity.init({ gl: this._gl, programInfo: this._programInfo });
      if (!sharedBuffer && entity.bufferInfo) {
        this._meshBuffers.set(meshKey, entity.bufferInfo);
        entity.markBufferAsShared();
      }
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

  private _createPart(part: RenderPartDefinition) {
    switch (part.primitive.type) {
      case "circle":
        return createCircle(part.primitive.radius);
      case "rectangle":
        return createRectangle(part.primitive);
      case "right-triangle":
        return createRightTriangle(part.primitive.width, part.primitive.height);
      case "polygon":
        return createPolygon(part.primitive.vertices);
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

  private _lastUsedProgram: WebGLProgram | undefined = undefined;
  private _initBuffer: boolean = true;
  private _lastUsedBuffer: BufferInfo | undefined = undefined;
  render() {
    const gl = this._gl;
    const canvas = gl.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Failed to get canvas element");
    }

    WebglUtils.resizeCanvasToDisplaySize(canvas, window.devicePixelRatio || 1);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // 2D parts are ordered by submission. Alpha blending supports highlights,
    // shadows, and other local render parts on the same entity.
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const cameraMatrix = this.camera.matrix();

    this._cleanup();
    this._drawEntities.forEach((object) => {
      if (object.markedForDeletion) {
        return;
      }
      if (!this._lastUsedProgram) {
        if (!object.programInfo) {
          throw new Error(
            "Cannot useProgram: Programinfo is undefined for object"
          );
        }

        gl.useProgram(object.programInfo.program);
        this._lastUsedProgram = object.programInfo.program;
        this._initBuffer = true;
      }

      if (this._initBuffer || this._lastUsedBuffer != object.bufferInfo) {
        object.setAttributes();
        this._lastUsedBuffer = object.bufferInfo;
        this._initBuffer = false;
      }

      if (!object.uniforms) {
        throw new Error(
          "Cannot setUniforms: Uniforms are undefined for object"
        );
      }

      object.uniforms.uResolution = [canvas.clientWidth, canvas.clientHeight];
      object.computeMatrix();
      mat3.multiply(object.matrix, cameraMatrix, object.matrix);
      object.setUniforms();

      if (!object.bufferInfo) {
        throw new Error(
          "Cannot drawArrays: Bufferinfo is undefined for object"
        );
      }

      if (this._drawMode === "LINES") {
        gl.drawArrays(gl.LINE_LOOP, 0, object.bufferInfo.numElements);
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, object.bufferInfo.numElements);
      }
    });
  }

  dispose() {
    const deletedBuffers = new Set<WebGLBuffer>();
    for (const bufferInfo of this._meshBuffers.values()) {
      for (const attribute of Object.values(bufferInfo.attributes)) {
        if (
          attribute.attributeType === "buffer" &&
          !deletedBuffers.has(attribute.buffer)
        ) {
          this._gl.deleteBuffer(attribute.buffer);
          deletedBuffers.add(attribute.buffer);
        }
      }
    }
    for (const entity of this._drawEntities) {
      entity.dispose();
    }
    this._drawEntities = [];
    this._meshBuffers.clear();
    this._gl.deleteProgram(this._programInfo.program);
  }
}
