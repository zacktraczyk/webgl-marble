import fragShader from "./glsl/frag.glsl";
import vertShader from "./glsl/vert.glsl";
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

  function createCircle({
    center,
    radius,
  }: {
    center: [number, number];
    radius: number;
  }) {
    if (!gl) {
      throw new Error("WebGlRenderingContext not initialized");
    }

    const circle = {
      center,
      radius,
    };

    const drawCircle = createDrawCircle({
      gl,
      programInfo,
      center,
      radius,
      numElements: 40,
    });

    objectsToDraw.push(drawCircle);

    return circle;
  }

  const c1 = createCircle({
    center: [100, 100],
    radius: 50,
  });

  const c2 = createCircle({
    center: [150, 150],
    radius: 50,
  });

  // Draw Scene

  function render(time: number) {
    drawScene();
    updateScene(time);

    requestAnimationFrame(render);
  }

  let lastUsedProgram: WebGLProgram;
  let initBuffer: boolean = true;
  let lastUsedBuffer: WebglUtils.BufferInfo;
  function drawScene() {
    if (!gl || !(gl.canvas instanceof HTMLCanvasElement)) {
      throw new Error("Failed to get canvas element");
    }

    WebglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    objectsToDraw.forEach((object) => {
      if (!lastUsedProgram) {
        gl.useProgram(object.programInfo.program);
        lastUsedProgram = object.programInfo.program;
        initBuffer = true;
      }

      if (initBuffer || lastUsedBuffer != object.bufferInfo) {
        WebglUtils.setAttributes(
          object.programInfo.attributeSetters,
          object.bufferInfo.attributes
        );
      }

      object.uniforms.uResolution = [gl.canvas.width, gl.canvas.height];

      WebglUtils.setUniforms(
        object.programInfo.uniformSetters,
        object.uniforms
      );

      gl.drawArrays(gl.LINE_LOOP, 0, object.bufferInfo.numElements);
    });
  }

  function updateScene(time: number) {
    time *= 0.005;

    c1.center[0] += Math.cos(time) * 2;
    c1.center[1] += Math.sin(time / 2) * 2;

    c2.center[0] += Math.sin(time / 1);
    c2.center[1] += Math.cos(time / 1);
  }

  requestAnimationFrame(render);
}

function createDrawCircle({
  gl,
  programInfo,
  center = [0, 0],
  radius = 1,
  numElements = 40,
}: {
  gl: WebGLRenderingContext;
  programInfo: WebglUtils.ProgramInfo;
  center: [number, number];
  radius: number;
  numElements: number;
}): WebglUtils.DrawObject {
  const indicies: number[] = [];
  indicies.concat(center);

  for (let i = 0; i <= numElements; i++) {
    const theta = (2 * Math.PI * i) / numElements;
    indicies.push(
      center[0] + radius * Math.cos(theta),
      center[1] + radius * Math.sin(theta)
    );
  }

  const drawObject = WebglUtils.createDrawObject({
    gl,
    programInfo,
    position: center,
    indicies,
  });
  return drawObject;
}

main();
