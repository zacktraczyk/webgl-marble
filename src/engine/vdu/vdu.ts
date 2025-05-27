import { BufferInfo, Drawable, DrawEntity, ProgramInfo } from "./entity";
import fragShader from "./glsl/frag.glsl";
import vertShader from "./glsl/vert.glsl";
import * as WebglUtils from "./webglUtils";

/**
 * Renders Drawable objects using WebGL
 */
export class VDU {
  readonly canvas: HTMLCanvasElement;
  private readonly _gl: WebGLRenderingContext;
  // private readonly _shaderProgram: WebGLProgram;
  private readonly _programInfo: ProgramInfo;
  private _drawEntities: DrawEntity[];

  private _drawMode: "TRIANGLES" | "LINES" = "TRIANGLES";

  constructor(canvasId: string) {
    // Create WebGL rendering context
    const canvas = document.querySelector(canvasId);
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Failed to get canvas element");
    }
    this.canvas = canvas;

    const gl = canvas.getContext("webgl", { antialias: true, depth: false });
    if (!gl) {
      throw new Error(
        "Unable to initialize WebGL. Your browser may not support it.",
      );
    }
    this._gl = gl;

    // Init shader
    const shaderProgram = WebglUtils.initShaderProgram(
      gl,
      vertShader,
      fragShader,
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
  }

  resizeCanvasToDisplaySize() {
    console.log("resizeCanvasToDisplaySize");
    const gl = this._gl;
    if (!(gl.canvas instanceof HTMLCanvasElement)) {
      throw new Error("Failed to get canvas element");
    }

    WebglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  private _cleanup() {
    const filteredEntities = this._drawEntities.filter(
      (entity) => !entity?.markedForDeletion,
    );

    this._drawEntities = filteredEntities;
  }

  set drawMode(mode: "TRIANGLES" | "LINES") {
    this._drawMode = mode;
  }

  get drawMode() {
    return this._drawMode;
  }

  add({ drawEntities }: Drawable) {
    for (const entity of drawEntities) {
      entity.init({
        gl: this._gl,
        programInfo: this._programInfo,
      });
      this._drawEntities.push(entity);
    }
  }

  private _lastUsedProgram: WebGLProgram | undefined = undefined;
  private _initBuffer: boolean = true;
  private _lastUsedBuffer: BufferInfo | undefined = undefined;
  render() {
    const gl = this._gl;
    if (!(gl.canvas instanceof HTMLCanvasElement)) {
      throw new Error("Failed to get canvas element");
    }

    WebglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this._cleanup();
    this._drawEntities.forEach((object) => {
      if (object.markedForDeletion) {
        return;
      }
      if (!this._lastUsedProgram) {
        if (!object.programInfo) {
          throw new Error(
            "Cannot useProgram: Programinfo is undefined for object",
          );
        }

        gl.useProgram(object.programInfo.program);
        this._lastUsedProgram = object.programInfo.program;
        this._initBuffer = true;
      }

      if (this._initBuffer || this._lastUsedBuffer != object.bufferInfo) {
        object.setAttributes();
      }

      if (!object.uniforms) {
        throw new Error(
          "Cannot setUniforms: Uniforms are undefined for object",
        );
      }

      object.uniforms.uResolution = [gl.canvas.width, gl.canvas.height];
      object.setUniforms();

      if (!object.bufferInfo) {
        throw new Error(
          "Cannot drawArrays: Bufferinfo is undefined for object",
        );
      }

      if (this._drawMode === "LINES") {
        gl.drawArrays(gl.LINE_LOOP, 0, object.bufferInfo.numElements);
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, object.bufferInfo.numElements);
      }
    });
  }
}
