import { mat3 } from "gl-matrix";
import type { Vec2 } from "../core/transform";
import { calculateCameraFit, type CameraFitInsets } from "./fit";

/** Camera state and coordinate transforms, independent from browser input. */
export class Camera2D {
  position: Vec2;
  zoom: number;
  private readonly matrixValue = mat3.create();

  constructor({
    position = [0, 0],
    zoom = 1,
  }: {
    position?: Vec2;
    zoom?: number;
  } = {}) {
    this.position = [...position];
    this.zoom = zoom;
  }

  matrix() {
    const matrix = mat3.identity(this.matrixValue);
    mat3.translate(matrix, matrix, this.position);
    mat3.scale(matrix, matrix, [this.zoom, this.zoom]);
    return matrix;
  }

  center(viewportWidth: number, viewportHeight: number) {
    this.position = [viewportWidth / 2, viewportHeight / 2];
  }

  panByScreen(deltaX: number, deltaY: number) {
    this.position[0] += deltaX;
    this.position[1] += deltaY;
  }

  zoomAtScreenPoint(screenX: number, screenY: number, zoom: number) {
    const [worldX, worldY] = this.screenToWorld(screenX, screenY);
    this.zoom = zoom;
    this.position[0] = screenX - worldX * zoom;
    this.position[1] = screenY - worldY * zoom;
  }

  screenToWorld(screenX: number, screenY: number): Vec2 {
    return [
      (screenX - this.position[0]) / this.zoom,
      (screenY - this.position[1]) / this.zoom,
    ];
  }

  worldToScreen(worldX: number, worldY: number): Vec2 {
    return [
      worldX * this.zoom + this.position[0],
      worldY * this.zoom + this.position[1],
    ];
  }

  fit({
    viewportWidth,
    viewportHeight,
    contentWidth,
    contentHeight,
    insets,
  }: {
    viewportWidth: number;
    viewportHeight: number;
    contentWidth: number;
    contentHeight: number;
    insets?: CameraFitInsets;
  }) {
    const fit = calculateCameraFit({
      viewportWidth,
      viewportHeight,
      contentWidth,
      contentHeight,
      insets,
    });
    this.zoom = fit.zoom;
    this.position = fit.position;
  }
}
