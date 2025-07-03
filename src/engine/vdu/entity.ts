import { mat3 } from "gl-matrix";
import * as id from "../utils/id";
import * as WebglUtils from "./webglUtils";

export type ProgramInfo = WebglUtils.ProgramInfo;
export type BufferInfo = WebglUtils.BufferInfo;
export type Uniform = WebglUtils.Uniform;

export interface Drawable {
  drawEntities: DrawEntity[];

  delete(): void;
}

export const isDrawable = (object: any): object is Drawable => {
  return "drawEntities" in object;
};

export class DrawEntity {
  readonly id;
  parent: Drawable | null;
  gl?: WebGLRenderingContext;
  programInfo?: ProgramInfo;
  private readonly _preInitIndicies?: number[] | Float32Array;
  bufferInfo?: BufferInfo;

  uniforms?: Record<string, Uniform>;

  position: [number, number];
  rotation: number; // radians
  scale: [number, number];

  color: [number, number, number, number];

  readonly matrix: mat3;

  markedForDeletion: boolean = false;

  constructor({
    parent,
    position,
    rotation,
    scale,
    color,
    ...bufferParams
  }: {
    parent: Drawable;
    position: [number, number];
    rotation: number;
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

    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.color = color;

    this.matrix = mat3.create();
    this.computeMatrix();

    if ("bufferInfo" in bufferParams) {
      const { bufferInfo } = bufferParams;
      this.bufferInfo = bufferInfo;
    } else {
      const { indicies } = bufferParams;
      this._preInitIndicies = indicies;
    }
  }

  init({
    gl,
    programInfo,
  }: {
    gl: WebGLRenderingContext;
    programInfo: ProgramInfo;
  }) {
    this.gl = gl;
    this.programInfo = programInfo;

    if (this._preInitIndicies) {
      const indicies = this._preInitIndicies;

      const indiciesBuffer = gl.createBuffer();
      if (!indiciesBuffer) {
        throw new Error("Failed to create buffer");
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, indiciesBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(indicies),
        gl.STATIC_DRAW
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
      uColor: this.color,
    };
    this.uniforms = uniforms;
  }

  delete() {
    if (this.markedForDeletion) {
      throw new Error(
        "Could not delete drawEntity: already marked for deletion"
      );
    }
    this.markedForDeletion = true;
  }

  computeMatrix() {
    mat3.identity(this.matrix);
    mat3.translate(this.matrix, this.matrix, this.position);
    mat3.rotate(this.matrix, this.matrix, this.rotation);
    mat3.scale(this.matrix, this.matrix, this.scale);
  }

  setAttributes() {
    if (!this.programInfo || !this.bufferInfo) {
      throw new Error(
        "Cannot setAttributes: programInfo or bufferInfo not initalized, please call init() before setting attributes."
      );
    }

    WebglUtils.setAttributes(
      this.programInfo.attributeSetters,
      this.bufferInfo.attributes
    );
  }

  setUniforms() {
    if (!this.programInfo || !this.uniforms) {
      throw new Error(
        "Cannot setUniforms: programInfo or uniforms not initialized, please call init() before setting uniforms"
      );
    }

    // Sync uniforms with object
    this.uniforms.uColor = this.color;
    this.uniforms.uMatrix = this.matrix;

    WebglUtils.setUniforms(this.programInfo.uniformSetters, this.uniforms);
  }
}

// TODO: Use instanced rendering
export const createCircle = (parent: Drawable, radius: number): DrawEntity => {
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
      radius * Math.sin(nextSegment)
    );
  }

  const drawEntity = new DrawEntity({
    parent,
    position: [0, 0],
    rotation: 0,
    scale: [1, 1],
    color: [1, 1, 1, 1],
    indicies,
  });

  return drawEntity;
};

// TODO: Use instanced rendering
export const createRectangle = ({
  parent,
  width,
  height,
}: {
  parent: Drawable;
  width: number;
  height: number;
}): DrawEntity => {
  const indicies: number[] = [];

  indicies.push(width * (1 / 2), height * -(1 / 2));
  indicies.push(width * -(1 / 2), height * -(1 / 2));
  indicies.push(width * (1 / 2), height * (1 / 2));

  indicies.push(width * -(1 / 2), height * -(1 / 2));
  indicies.push(width * -(1 / 2), height * (1 / 2));
  indicies.push(width * (1 / 2), height * (1 / 2));

  const drawEntity = new DrawEntity({
    parent,
    position: [0, 0],
    rotation: 0,
    scale: [1, 1],
    color: [1, 1, 1, 1],
    indicies,
  });

  return drawEntity;
};

// TODO: FIXME hacky and weird
export const createRectangleOriginLeftCenter = ({
  parent,
  width,
  height,
}: {
  parent: Drawable;
  width: number;
  height: number;
}): DrawEntity => {
  const indicies: number[] = [];

  indicies.push(width * 1, height * -(1 / 2));
  indicies.push(width * 0, height * -(1 / 2));
  indicies.push(width * 1, height * (1 / 2));

  indicies.push(width * 0, height * -(1 / 2));
  indicies.push(width * 0, height * (1 / 2));
  indicies.push(width * 1, height * (1 / 2));

  const drawEntity = new DrawEntity({
    parent,
    position: [0, 0],
    rotation: 0,
    scale: [1, 1],
    color: [1, 1, 1, 1],
    indicies,
  });

  return drawEntity;
};
