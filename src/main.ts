import fragShader from "./glsl/frag.glsl";
import vertShader from "./glsl/vert.glsl";
import { mat4 } from "gl-matrix";
import "./style.css";
import * as WebglUtils from "./utils/webglUtils";

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

  const shaderProgram = WebglUtils.initShaderProgram(
    gl,
    vertShader,
    fragShader
  );
  if (!shaderProgram) {
    throw new Error("Failed to initialize shader program");
  }

  const attribSetters = WebglUtils.createAttributeSetters(gl, shaderProgram);
  const uniformSetters = WebglUtils.createUniformSetters(gl, shaderProgram);

  const programInfo: WebglUtils.ProgramInfo = {
    program: shaderProgram,
    attributeSetters: attribSetters,
    uniformSetters,
  };

  // Create Draw Objects

  const objectsToDraw: WebglUtils.DrawObject[] = [];

  const c1 = createCircle({
    gl,
    programInfo,
    center: [-2, 0],
    radius: 1,
    numVertices: 40,
  });

  const c2 = createCircle({
    gl,
    programInfo,
    center: [2, 0],
    radius: 1,
    numVertices: 40,
  });

  objectsToDraw.push(c1, c2);

  // Draw Scene

  requestAnimationFrame(drawScene);

  function drawScene(time: number) {
    if (!gl || !(gl.canvas instanceof HTMLCanvasElement)) {
      throw new Error("Failed to get canvas element");
    }
    time *= 0.0005;

    WebglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfView = (45 * Math.PI) / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;

    objectsToDraw.forEach((object) => {
      gl.useProgram(object.programInfo.program);

      WebglUtils.setAttributes(
        object.programInfo.attributeSetters,
        object.bufferInfo.attributes
      );

      // TODO: Fix projection and model view matrix
      // Q: (make global ? Specific to object ? How do projection matrices work ?)
      const projectionMatrix = object.uniforms["uProjectionMatrix"] as mat4;
      mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
      const modelViewMatrix = object.uniforms["uModelViewMatrix"] as mat4;
      mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -6.0]);

      WebglUtils.setUniforms(
        object.programInfo.uniformSetters,
        object.uniforms
      );

      gl.drawArrays(gl.LINE_LOOP, 0, object.bufferInfo.numElements);
    });
  }
}

function createCircle({
  gl,
  programInfo,
  center = [0, 0],
  radius = 1,
  numVertices = 40,
}: {
  gl: WebGLRenderingContext;
  programInfo: WebglUtils.ProgramInfo;
  center: [number, number];
  radius: number;
  numVertices: number;
}): WebglUtils.DrawObject {
  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) {
    throw new Error("Failed to create buffer");
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions: number[] = [];
  positions.concat(center);

  for (let i = 0; i <= numVertices; i++) {
    const theta = (2 * Math.PI * i) / numVertices;
    positions.push(
      center[0] + radius * Math.cos(theta),
      center[1] + radius * Math.sin(theta)
    );
  }

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const circleObject: WebglUtils.DrawObject = {
    programInfo,
    bufferInfo: {
      numElements: numVertices,
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

  return circleObject;
}

main();
