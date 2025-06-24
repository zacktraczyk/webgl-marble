import { mat3 } from "gl-matrix";
import { BufferInfo, Drawable, DrawEntity, ProgramInfo } from "./entity";
import fragShader from "./glsl/frag.glsl";
import vertShader from "./glsl/vert.glsl";
import * as WebglUtils from "./webglUtils";

/**
 * Renders Drawable objects using WebGL
 */
export class VDU {
  readonly canvas: HTMLCanvasElement;
  private readonly _gl: WebGLRenderingContext;
  // private readonly _shaderProgram: WebGLProgram;
  private readonly _programInfo: ProgramInfo;
  private _drawEntities: DrawEntity[];
  private readonly _camera: Camera;

  private _drawMode: "TRIANGLES" | "LINES" = "TRIANGLES";

  constructor(canvasId: string) {
    // Create WebGL rendering context
    const canvas = document.querySelector(canvasId);
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Failed to get canvas element");
    }
    this.canvas = canvas;

    const gl = canvas.getContext("webgl", { antialias: true, depth: false });
    if (!gl) {
      throw new Error(
        "Unable to initialize WebGL. Your browser may not support it.",
      );
    }
    this._gl = gl;

    // Init shader
    const shaderProgram = WebglUtils.initShaderProgram(
      gl,
      vertShader,
      fragShader,
    );
    if (!shaderProgram) {
      throw new Error("Failed to initialize shader program");
    }

    // Create program info
    const attribSetters = WebglUtils.createAttributeSetters(gl, shaderProgram);
    const uniformSetters = WebglUtils.createUniformSetters(gl, shaderProgram);
    const programInfo: ProgramInfo = {
      program: shaderProgram,
      attributeSetters: attribSetters,
      uniformSetters,
    };
    this._programInfo = programInfo;

    // Init draw objects
    this._drawEntities = [];

    // Init camera
    this._camera = new Camera({
      position: [0, 0],
      zoom: 1,
    });
  }

  private _cleanup() {
    const filteredEntities = this._drawEntities.filter(
      (entity) => !entity?.markedForDeletion,
    );

    this._drawEntities = filteredEntities;
  }

  set drawMode(mode: "TRIANGLES" | "LINES") {
    this._drawMode = mode;
  }

  get drawMode() {
    return this._drawMode;
  }

  add({ drawEntities }: Drawable) {
    for (const entity of drawEntities) {
      entity.init({
        gl: this._gl,
        programInfo: this._programInfo,
      });
      this._drawEntities.push(entity);
    }
  }

  private _lastUsedProgram: WebGLProgram | undefined = undefined;
  private _initBuffer: boolean = true;
  private _lastUsedBuffer: BufferInfo | undefined = undefined;
  render() {
    const gl = this._gl;
    if (!(gl.canvas instanceof HTMLCanvasElement)) {
      throw new Error("Failed to get canvas element");
    }

    WebglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const cameraMatrix = this._camera.matrix();

    this._cleanup();
    this._drawEntities.forEach((object) => {
      if (object.markedForDeletion) {
        return;
      }
      if (!this._lastUsedProgram) {
        if (!object.programInfo) {
          throw new Error(
            "Cannot useProgram: Programinfo is undefined for object",
          );
        }

        gl.useProgram(object.programInfo.program);
        this._lastUsedProgram = object.programInfo.program;
        this._initBuffer = true;
      }

      if (this._initBuffer || this._lastUsedBuffer != object.bufferInfo) {
        object.setAttributes();
      }

      if (!object.uniforms) {
        throw new Error(
          "Cannot setUniforms: Uniforms are undefined for object",
        );
      }

      object.uniforms.uResolution = [gl.canvas.width, gl.canvas.height];
      object.computeMatrix();
      mat3.multiply(object.matrix, cameraMatrix, object.matrix);
      object.setUniforms();

      if (!object.bufferInfo) {
        throw new Error(
          "Cannot drawArrays: Bufferinfo is undefined for object",
        );
      }

      if (this._drawMode === "LINES") {
        gl.drawArrays(gl.LINE_LOOP, 0, object.bufferInfo.numElements);
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, object.bufferInfo.numElements);
      }
    });
  }

  // Camera

  pan(delta: [number, number]) {
    this._camera.position[0] += delta[0] / this._camera.zoom;
    this._camera.position[1] += delta[1] / this._camera.zoom;
  }

  set zoom(value: number) {
    this._camera.zoom = value;
  }

  get zoom() {
    return this._camera.zoom;
  }

  private _isPanAndZoomEnabled = false;
  private _isPanAndZoomRegistered = false;
  private _isPanning = false;
  private _lastPos: [number, number] | null = null;
  private _lastZoom: number | null = null;
  private _pointerDownHandler(event: PointerEvent) {
    event.preventDefault();
    if (!this._isPanAndZoomEnabled) {
      return;
    }

    this._lastPos = [event.clientX, event.clientY];
    this._isPanning = true;
  }
  private _pointerMoveHandler(event: PointerEvent) {
    event.preventDefault();
    if (!this._isPanAndZoomEnabled) {
      return;
    }
    if (!this._isPanning) {
      return;
    }

    const currentPos: [number, number] = [event.clientX, event.clientY];
    if (this._lastPos) {
      this.pan([
        currentPos[0] - this._lastPos[0],
        currentPos[1] - this._lastPos[1],
      ]);
    }
    this._lastPos = currentPos;
  }
  private _pointerUpHandler(event: PointerEvent) {
    if (!this._isPanAndZoomEnabled) {
      return;
    }

    event.preventDefault();
    this._lastPos = null;
    this._isPanning = false;
  }
  private _wheelHandler(event: WheelEvent) {
    if (!this._isPanAndZoomEnabled) {
      return;
    }

    event.preventDefault();
    this._lastZoom = this.zoom;
    this.zoom = this._lastZoom + event.deltaY * 0.001;
    this._lastZoom = this.zoom;
  }
  private _mouseLeaveHandler() {
    this._lastPos = null;
    this._isPanning = false;
  }
  private _registerPanAndZoomHandlers() {
    if (this._isPanAndZoomRegistered) {
      console.warn("VDU: Pan and zoom handlers already registered");
      return;
    }

    this._isPanAndZoomRegistered = true;

    // Panning
    this.canvas.addEventListener(
      "pointerdown",
      this._pointerDownHandler.bind(this),
    );
    this.canvas.addEventListener(
      "pointermove",
      this._pointerMoveHandler.bind(this),
    );
    this.canvas.addEventListener(
      "pointerup",
      this._pointerUpHandler.bind(this),
    );
    this.canvas.addEventListener("wheel", this._wheelHandler.bind(this));
    this.canvas.addEventListener(
      "mouseleave",
      this._mouseLeaveHandler.bind(this),
    );

    // Zooming
    this.canvas.addEventListener("wheel", this._wheelHandler.bind(this));

    // TODO: Touch pan & zoom

    this.canvas.addEventListener(
      "mouseleave",
      this._mouseLeaveHandler.bind(this),
    );
  }

  // TODO: Unregister handlers when VDU is destroyed
  private _unregisterPanAndZoomHandlers() {
    if (!this._isPanAndZoomRegistered) {
      console.warn("VDU: Pan and zoom handlers not registered");
      return;
    }

    this._isPanAndZoomRegistered = false;

    this.canvas.removeEventListener(
      "pointerdown",
      this._pointerDownHandler.bind(this),
    );
    this.canvas.removeEventListener(
      "pointermove",
      this._pointerMoveHandler.bind(this),
    );
    this.canvas.removeEventListener(
      "pointerup",
      this._pointerUpHandler.bind(this),
    );
    this.canvas.removeEventListener("wheel", this._wheelHandler.bind(this));
    this.canvas.removeEventListener(
      "mouseleave",
      this._mouseLeaveHandler.bind(this),
    );
  }

  set panAndZoom(value: boolean) {
    if (this._isPanAndZoomEnabled === value) {
      return;
    }

    if (value) {
      if (!this._isPanAndZoomRegistered) {
        this._registerPanAndZoomHandlers();
      }
      this._isPanAndZoomEnabled = true;
    } else {
      this._isPanAndZoomEnabled = false;
    }
  }

  get panAndZoom() {
    return this._isPanAndZoomEnabled;
  }
}

class Camera {
  // origin: [number, number];
  position: [number, number];
  // rotation: number;
  zoom: number;

  private _matrix: mat3;

  constructor({
    // origin = [0, 0],
    position = [0, 0],
    zoom = 1,
  }: {
    position?: [number, number];
    zoom?: number;
  }) {
    this.position = position;
    this.zoom = zoom;

    this._matrix = mat3.create();
  }

  matrix(): mat3 {
    const matrix = mat3.identity(this._matrix);
    mat3.scale(matrix, matrix, [this.zoom, this.zoom]);
    mat3.translate(matrix, matrix, [this.position[0], this.position[1]]);

    return matrix;
  }
}
