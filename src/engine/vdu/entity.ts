import { mat3 } from "gl-matrix";
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
  deleteDrawEntity(): void;
}
/**
 * Objects rendered by VDU, constructed from a Drawable object
 */
export class DrawEntity {
  parent: Drawable;
  readonly gl: WebGLRenderingContext;
  readonly programInfo: ProgramInfo;
  readonly bufferInfo: BufferInfo;
  readonly uniforms: Record<string, Uniform>;

  readonly position: [number, number];
  readonly rotation: [number];
  readonly scale: [number, number];

  readonly matrix: mat3;

  markedForDeletion: boolean = false;

  constructor({
    parent,
    gl,
    programInfo,
    position,
    rotation,
    scale,
    color,
    ...bufferParams
  }: {
    parent: Drawable;
    gl: WebGLRenderingContext;
    programInfo: ProgramInfo;
    position: [number, number];
    rotation: [number];
    scale: [number, number];
    color: [number, number, number, number];
  } & (
    | {
        bufferInfo: BufferInfo;
      }
    | {
        indicies: number[] | Float32Array;
      }
  )) {
    this.parent = parent;
    this.gl = gl;
    this.programInfo = programInfo;

    this.position = position;
    this.rotation = rotation;
    this.scale = scale;

    this.matrix = mat3.create();
    this.computeMatrix();

    if ("bufferInfo" in bufferParams) {
      const { bufferInfo } = bufferParams;
      this.bufferInfo = bufferInfo;
    } else {
      const { indicies } = bufferParams;

      const indiciesBuffer = gl.createBuffer();
      if (!indiciesBuffer) {
        throw new Error("Failed to create buffer");
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, indiciesBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(indicies),
        gl.STATIC_DRAW,
      );
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
    }

    const uniforms = {
      uResolution: [gl.canvas.width, gl.canvas.height],
      uMatrix: this.matrix,
      uColor: color,
    };
    this.uniforms = uniforms;
  }

  computeMatrix() {
    mat3.identity(this.matrix);
    mat3.translate(this.matrix, this.matrix, this.position);
    mat3.rotate(this.matrix, this.matrix, this.rotation[0]);
    mat3.scale(this.matrix, this.matrix, this.scale);
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
