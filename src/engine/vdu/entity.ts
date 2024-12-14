import * as WebglUtils from "./webglUtils";

/**
 * Required properties and methods for an object to be drawable by VDU
 */
export abstract class Drawable {
  abstract createDrawEntity(
    gl: WebGLRenderingContext,
    programInfo: WebglUtils.ProgramInfo,
  ): DrawEntity;
}

/**
 * Objects rendered by VDU, constructed from a Drawable object
 */
export class DrawEntity {
  readonly gl: WebGLRenderingContext;
  readonly programInfo: WebglUtils.ProgramInfo;
  readonly bufferInfo: WebglUtils.BufferInfo;
  readonly uniforms: Record<string, WebglUtils.Uniform>;

  constructor({
    gl,
    programInfo,
    position,
    color,
    indicies,
  }: {
    gl: WebGLRenderingContext;
    programInfo: WebglUtils.ProgramInfo;
    position: [number, number];
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
