import fragShader from "../glsl/frag.glsl";
import vertShader from "../glsl/vert.glsl";
import * as WebglUtils from "./webglUtils";

/**
 * Required properties and methods for an object to be drawable by VDU
 */
export abstract class Drawable {
  abstract position: [number, number];

  abstract createIndicies(): number[] | Float32Array;
}

/**
 * Objects rendered by VDU, constructed from a Drawable object
 */
class DrawObject {
  private readonly gl: WebGLRenderingContext;
  readonly programInfo: WebglUtils.ProgramInfo;
  readonly bufferInfo: WebglUtils.BufferInfo;
  readonly uniforms: Record<string, WebglUtils.Uniform>;

  constructor({
    gl,
    programInfo,
    position,
    indicies,
  }: {
    gl: WebGLRenderingContext;
    programInfo: WebglUtils.ProgramInfo;
    position: [number, number];
    indicies: number[] | Float32Array;
  }) {
    this.gl = gl;
    this.programInfo = programInfo;

    const indiciesBuffer = gl.createBuffer();
    if (!indiciesBuffer) {
      throw new Error("Failed to create buffer");
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, indiciesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(indicies), gl.STATIC_DRAW);
    const bufferInfo: WebglUtils.BufferInfo = {
      numElements: indicies.length / 2,
      attributes: {
        aVertexPosition: {
          attributeType: "buffer",
          buffer: indiciesBuffer,
          size: 2,
          type: gl.FLOAT,
          normalize: false,
          stride: 0,
          offset: 0,
        },
      },
    };
    this.bufferInfo = bufferInfo;

    const uniforms = {
      uResolution: [gl.canvas.width, gl.canvas.height],
      uTranslation: position,
    };
    this.uniforms = uniforms;
  }

  setAttributes() {
    WebglUtils.setAttributes(
      this.programInfo.attributeSetters,
      this.bufferInfo.attributes,
    );
  }

  setUniforms() {
    WebglUtils.setUniforms(this.programInfo.uniformSetters, this.uniforms);
  }

  draw() {
    const gl = this.gl;
    gl.drawArrays(gl.LINE_LOOP, 0, this.bufferInfo.numElements);
  }
}

/**
 * Renders Drawable objects using WebGL
 */
export class VDU {
  readonly canvas: HTMLCanvasElement;
  private readonly _gl: WebGLRenderingContext;
  private readonly _shaderProgram: WebGLProgram;
  private readonly _programInfo: WebglUtils.ProgramInfo;
  private readonly _objectsToDraw: DrawObject[];

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
    this._shaderProgram = shaderProgram;

    // Create program info
    const attribSetters = WebglUtils.createAttributeSetters(gl, shaderProgram);
    const uniformSetters = WebglUtils.createUniformSetters(gl, shaderProgram);
    const programInfo: WebglUtils.ProgramInfo = {
      program: shaderProgram,
      attributeSetters: attribSetters,
      uniformSetters,
    };
    this._programInfo = programInfo;

    // Init draw objects
    this._objectsToDraw = [];
  }

  add(obj: Drawable) {
    const drawObject = new DrawObject({
      gl: this._gl,
      programInfo: this._programInfo,
      position: obj.position,
      indicies: obj.createIndicies(),
    });

    this._objectsToDraw.push(drawObject);
  }

  private _lastUsedProgram: WebGLProgram | undefined = undefined;
  private _initBuffer: boolean = true;
  private _lastUsedBuffer: WebglUtils.BufferInfo | undefined = undefined;
  render() {
    const gl = this._gl;
    if (!(gl.canvas instanceof HTMLCanvasElement)) {
      throw new Error("Failed to get canvas element");
    }

    // WebglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this._objectsToDraw.forEach((object) => {
      if (!this._lastUsedProgram) {
        gl.useProgram(object.programInfo.program);
        this._lastUsedProgram = object.programInfo.program;
        this._initBuffer = true;
      }

      if (this._initBuffer || this._lastUsedBuffer != object.bufferInfo) {
        WebglUtils.setAttributes(
          object.programInfo.attributeSetters,
          object.bufferInfo.attributes,
        );
      }

      object.uniforms.uResolution = [gl.canvas.width, gl.canvas.height];

      WebglUtils.setUniforms(
        object.programInfo.uniformSetters,
        object.uniforms,
      );

      gl.drawArrays(gl.LINE_LOOP, 0, object.bufferInfo.numElements);
    });
  }
}
