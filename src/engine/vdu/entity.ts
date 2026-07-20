import { mat3 } from "gl-matrix";
import type { EntityId } from "../core/entity";
import type { Transform } from "../core/transform";
import * as id from "../utils/id";
import * as WebglUtils from "./webglUtils";
import type { ProgramInfo, BufferInfo, Uniform } from "./webglUtils";

export class DrawEntity {
  readonly id;
  ownerId?: EntityId;
  rootTransform?: Transform;
  gl?: WebGLRenderingContext;
  programInfo?: ProgramInfo;
  private readonly _preInitIndices?: number[] | Float32Array;
  bufferInfo?: BufferInfo;
  private _ownsBuffer = false;

  uniforms?: Record<string, Uniform>;

  position: [number, number];
  rotation: number; // radians
  scale: [number, number];

  color: [number, number, number, number];

  readonly matrix: mat3;

  markedForDeletion: boolean = false;

  constructor({
    position,
    rotation,
    scale,
    color,
    ...bufferParams
  }: {
    position: [number, number];
    rotation: number;
    scale: [number, number];
    color: [number, number, number, number];
  } & (
    | {
        bufferInfo: BufferInfo;
      }
    | {
        indices: number[] | Float32Array;
      }
  )) {
    this.id = id.getNext();

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
      const { indices } = bufferParams;
      this._preInitIndices = indices;
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

    if (this._preInitIndices && !this.bufferInfo) {
      const indices = this._preInitIndices;

      const indicesBuffer = gl.createBuffer();
      if (!indicesBuffer) {
        throw new Error("Failed to create buffer");
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, indicesBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(indices),
        gl.STATIC_DRAW
      );
      const bufferInfo: BufferInfo = {
        numElements: indices.length / 2,
        attributes: {
          aVertexPosition: {
            attributeType: "buffer",
            buffer: indicesBuffer,
            size: 2,
            type: gl.FLOAT,
            normalize: false,
            stride: 0,
            offset: 0,
          },
        },
      };
      this.bufferInfo = bufferInfo;
      this._ownsBuffer = true;
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
      return;
    }
    this.markedForDeletion = true;
  }

  attachToEntity(ownerId: EntityId, rootTransform: Transform) {
    this.ownerId = ownerId;
    this.rootTransform = rootTransform;
  }

  useSharedBuffer(bufferInfo: BufferInfo) {
    this.bufferInfo = bufferInfo;
    this._ownsBuffer = false;
  }

  markBufferAsShared() {
    this._ownsBuffer = false;
  }

  dispose() {
    if (!this.gl || !this.bufferInfo || !this._ownsBuffer) {
      return;
    }
    for (const attribute of Object.values(this.bufferInfo.attributes)) {
      if (attribute.attributeType === "buffer") {
        this.gl.deleteBuffer(attribute.buffer);
      }
    }
    this.bufferInfo = undefined;
  }

  computeMatrix() {
    mat3.identity(this.matrix);
    if (this.rootTransform) {
      mat3.translate(this.matrix, this.matrix, this.rootTransform.position);
      mat3.rotate(this.matrix, this.matrix, this.rootTransform.rotation);
      mat3.scale(this.matrix, this.matrix, this.rootTransform.scale);
    }
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
export const createCircle = (radius: number): DrawEntity => {
  const segments = 32;
  const thetaStart = 0;
  const thetaLength = 2 * Math.PI;

  const indices: number[] = [];

  for (let s = 0; s <= segments - 1; s++) {
    const segment = thetaStart + (s / segments) * thetaLength;
    const nextSegment = thetaStart + ((s - 1) / segments) * thetaLength;

    indices.push(0, 0);

    indices.push(radius * Math.cos(segment), radius * Math.sin(segment));

    indices.push(
      radius * Math.cos(nextSegment),
      radius * Math.sin(nextSegment)
    );
  }

  const drawEntity = new DrawEntity({
    position: [0, 0],
    rotation: 0,
    scale: [1, 1],
    color: [1, 1, 1, 1],
    indices,
  });

  return drawEntity;
};

export const createPolygon = (
  vertices: readonly [number, number][]
): DrawEntity => {
  if (vertices.length < 3) {
    throw new Error("A render polygon requires at least three vertices");
  }
  const indices: number[] = [];
  for (let index = 1; index < vertices.length - 1; index++) {
    indices.push(
      vertices[0][0],
      vertices[0][1],
      vertices[index][0],
      vertices[index][1],
      vertices[index + 1][0],
      vertices[index + 1][1]
    );
  }
  return new DrawEntity({
    position: [0, 0],
    rotation: 0,
    scale: [1, 1],
    color: [1, 1, 1, 1],
    indices,
  });
};

// TODO: Use instanced rendering
export const createRectangle = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): DrawEntity => {
  const indices: number[] = [];

  indices.push(width * (1 / 2), height * -(1 / 2));
  indices.push(width * -(1 / 2), height * -(1 / 2));
  indices.push(width * (1 / 2), height * (1 / 2));

  indices.push(width * -(1 / 2), height * -(1 / 2));
  indices.push(width * -(1 / 2), height * (1 / 2));
  indices.push(width * (1 / 2), height * (1 / 2));

  const drawEntity = new DrawEntity({
    position: [0, 0],
    rotation: 0,
    scale: [1, 1],
    color: [1, 1, 1, 1],
    indices,
  });

  return drawEntity;
};

export const createRightTriangle = (
  width: number,
  height: number
): DrawEntity => {
  // Center of triangle is at (0, 0)
  const indices2: number[] = [];

  indices2.push(width * (-1 / 2), height * -(1 / 2));
  indices2.push(width * (1 / 2), height * (1 / 2));
  indices2.push(width * (-1 / 2), height * (1 / 2));

  const drawEntity = new DrawEntity({
    position: [0, 0],
    rotation: 0,
    scale: [1, 1],
    color: [1, 1, 1, 1],
    indices: indices2,
  });

  return drawEntity;
};
