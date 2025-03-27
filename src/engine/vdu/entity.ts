import { mat3 } from "gl-matrix";
import * as id from "../../utils/id";
import * as WebglUtils from "./webglUtils";

export type ProgramInfo = WebglUtils.ProgramInfo;
export type BufferInfo = WebglUtils.BufferInfo;
export type Uniform = WebglUtils.Uniform;

export interface Drawable {
  drawEntity: DrawEntity | null;
  delete(): void;

  createDrawEntity(
    gl: WebGLRenderingContext,
    programInfo: ProgramInfo,
  ): DrawEntity;
}

export class DrawEntity {
  readonly id;
  parent: Drawable | null;
  readonly gl: WebGLRenderingContext;
  readonly programInfo: ProgramInfo;
  readonly bufferInfo: BufferInfo;
  readonly uniforms: Record<string, Uniform>;

  readonly position: [number, number];
  readonly rotation: [number]; // radians
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
    this.id = id.getNext();
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

  delete() {
    if (this.markedForDeletion) {
      throw new Error(
        "Could not delete drawEntity: already marked for deletion",
      );
    }
    this.markedForDeletion = true;
    if (this.parent && "drawEntities" in this.parent) {
      this.parent.drawEntities = null;
    }
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

export const createCircle = (
  vduContext: {
    gl: WebGLRenderingContext;
    programInfo: ProgramInfo;
  },
  parent: Drawable,
  radius: number,
): DrawEntity => {
  const segments = 32;
  const thetaStart = 0;
  const thetaLength = 2 * Math.PI;

  const indicies: number[] = [];

  for (let s = 0; s <= segments - 1; s++) {
    const segment = thetaStart + (s / segments) * thetaLength;
    const nextSegment = thetaStart + ((s - 1) / segments) * thetaLength;

    indicies.push(0, 0);

    indicies.push(radius * Math.cos(segment), radius * Math.sin(segment));

    indicies.push(
      radius * Math.cos(nextSegment),
      radius * Math.sin(nextSegment),
    );
  }

  const drawEntity = new DrawEntity({
    ...vduContext,
    parent,
    position: [0, 0],
    rotation: [0],
    scale: [1, 1],
    color: [1, 1, 1, 1],
    indicies,
  });

  return drawEntity;
};

export const createRectangle = (
  vduContext: {
    gl: WebGLRenderingContext;
    programInfo: ProgramInfo;
  },
  parent: Drawable,
  width: number,
  height: number,
): DrawEntity => {
  const indicies: number[] = [];

  indicies.push(width * (1 / 2), height * -(1 / 2));
  indicies.push(width * -(1 / 2), height * -(1 / 2));
  indicies.push(width * (1 / 2), height * (1 / 2));

  indicies.push(width * -(1 / 2), height * -(1 / 2));
  indicies.push(width * -(1 / 2), height * (1 / 2));
  indicies.push(width * (1 / 2), height * (1 / 2));

  const drawEntity = new DrawEntity({
    ...vduContext,
    parent,
    position: [0, 0],
    rotation: [0],
    scale: [1, 1],
    color: [1, 1, 1, 1],
    indicies,
  });

  return drawEntity;
};
