import { mat4 } from "gl-matrix";
import "./style.css";

function main() {
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

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

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

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(
        shaderProgram,
        "uProjectionMatrix"
      ),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
    },
  };

  const positionBuffer = initPositionBuffer(gl);

  drawScene(gl, programInfo, positionBuffer);
}

function drawScene(
  gl: WebGLRenderingContext,
  programInfo: any,
  positionBuffer: WebGLBuffer
) {
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
  const projectionMatrix = mat4.create();

  mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  const modelViewMatrix = mat4.create();

  mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -6.0]);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPosition,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

  gl.useProgram(programInfo.program);

  gl.uniformMatrix4fv(
    programInfo.uniformLocations.projectionMatrix,
    false,
    projectionMatrix
  );
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.modelViewMatrix,
    false,
    modelViewMatrix
  );

  gl.drawArrays(gl.LINE_LOOP, 0, num_vertices);
}

function initShaderProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  if (!vertexShader || !fragmentShader) {
    throw new Error("Failed to load shaders");
  }

  const shaderProgram = gl.createProgram();
  if (!shaderProgram) {
    throw new Error("Failed to create shader program");
  }

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shaderProgram
      )}`
    );
    return null;
  }

  return shaderProgram;
}

function loadShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(
      `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

let num_vertices = 20;

function initPositionBuffer(gl: WebGLRenderingContext) {
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
  // for (let a = 0; a < 360; a += 360/sides) {
  //   const heading = a * Math.PI / 180;
  //   vertices.add(

  //   }

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  return positionBuffer;
}

main();
