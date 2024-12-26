import * as WebglUtils from "./webglUtils";

export type ProgramInfo = WebglUtils.ProgramInfo;
export type BufferInfo = WebglUtils.BufferInfo;
export type Uniform = WebglUtils.Uniform;

/**
 * Required properties and methods for an object to be drawable by VDU
 */
export interface Drawable {
  createDrawEntity(
    gl: WebGLRenderingContext,
    programInfo: ProgramInfo,
  ): DrawEntity;
}

/**
 * Objects rendered by VDU, constructed from a Drawable object
 */
export class DrawEntity {
  readonly gl: WebGLRenderingContext;
  readonly programInfo: ProgramInfo;
  readonly bufferInfo: BufferInfo;
  readonly uniforms: Record<string, Uniform>;

  constructor({
    gl,
    programInfo,
    position,
    rotation,
    color,
    indicies,
  }: {
    gl: WebGLRenderingContext;
    programInfo: ProgramInfo;
    position: [number, number];
    rotation: [number, number];
    color: [number, number, number, number];
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
    const bufferInfo: BufferInfo = {
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
      uRotation: rotation,
      uColor: color,
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
}
