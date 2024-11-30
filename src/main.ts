import { mat4 } from "gl-matrix";
import "./style.css";
import {
  Attribute,
  AttributeSetters,
  createAttributeSetters,
  createUniformSetters,
  initShaderProgram,
  setAttributes,
  setUniforms,
  Uniform,
  UniformSetters,
} from "./utils/util";

type ProgramInfo = {
  program: WebGLProgram;
  attributeSetters: AttributeSetters;
  uniformSetters: UniformSetters;
};

type DrawObject = {
  programInfo: ProgramInfo;
  bufferInfo: {
    numElements: number;
    attributes: Record<string, Attribute>;
  };
  uniforms: Record<string, Uniform>;
};

function main() {
  // Get A WebGL context

  const canvas = document.querySelector("#gl-canvas");
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Failed to get canvas element");
  }

  const gl = canvas.getContext("webgl", { antialias: true, depth: false });
  if (!gl) {
    throw new Error(
      "Unable to initialize WebGL. Your browser may not support it."
    );
  }

  // Create Program Info

  const vsSource = `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    
    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
    `;

  const fsSource = `
    void main(void) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
    `;

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  if (!shaderProgram) {
    throw new Error("Failed to initialize shader program");
  }

  const attribSetters = createAttributeSetters(gl, shaderProgram);
  const uniformSetters = createUniformSetters(gl, shaderProgram);

  const programInfo: ProgramInfo = {
    program: shaderProgram,
    attributeSetters: attribSetters,
    uniformSetters,
  };

  // Create Draw Objects

  const objectsToDraw: DrawObject[] = [];

  // Create Circle

  let num_vertices = 20;

  const positionBuffer = gl.createBuffer();

  if (!positionBuffer) {
    throw new Error("Failed to create buffer");
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const center = [0, 0];
  const radius = 1;

  const positions: number[] = [];
  positions.concat(center);

  for (let i = 0; i <= num_vertices; i++) {
    const theta = (2 * Math.PI * i) / num_vertices;
    positions.push(
      center[0] + radius * Math.cos(theta),
      center[1] + radius * Math.sin(theta)
    );
  }

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const circleObject: DrawObject = {
    programInfo,
    bufferInfo: {
      numElements: num_vertices,
      attributes: {
        aVertexPosition: {
          attributeType: "buffer",
          buffer: positionBuffer,
          size: 2,
          type: gl.FLOAT,
          normalize: false,
          stride: 0,
          offset: 0,
        },
      },
    },
    uniforms: {
      uProjectionMatrix: mat4.create(),
      uModelViewMatrix: mat4.create(),
    },
  };
  objectsToDraw.push(circleObject);

  drawScene(gl, objectsToDraw);
}

function drawScene(gl: WebGLRenderingContext, objectsToDraw: DrawObject[]) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const fieldOfView = (45 * Math.PI) / 180;
  if (!(gl.canvas instanceof HTMLCanvasElement)) {
    throw new Error("Failed to get canvas element");
  }
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;

  objectsToDraw.forEach((object) => {
    // TODO: Fix uMatrixs
    const projectionMatrix = object.uniforms["uProjectionMatrix"] as mat4;
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
    const modelViewMatrix = object.uniforms["uModelViewMatrix"] as mat4;
    mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -6.0]);

    gl.useProgram(object.programInfo.program);

    setAttributes(
      object.programInfo.attributeSetters,
      object.bufferInfo.attributes
    );

    setUniforms(object.programInfo.uniformSetters, object.uniforms);

    gl.drawArrays(gl.LINE_LOOP, 0, object.bufferInfo.numElements);
  });
}

main();
