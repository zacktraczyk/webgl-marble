import type { Vec2 } from "../core/transform";
import type { Camera2D } from "./camera2d";
import { type CameraFitInsetSource, uniformCameraFitInsets } from "./fit";

export type CameraResizeControllerOptions = {
  signal: AbortSignal;
  getContentSize: () => Vec2;
  insets?: CameraFitInsetSource;
};

/** Keeps a camera fitted to content when its browser viewport changes. */
export class CameraResizeController {
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera2D,
    {
      signal,
      getContentSize,
      insets = uniformCameraFitInsets(0),
    }: CameraResizeControllerOptions
  ) {
    this.getContentSize = getContentSize;
    this.insets = insets;
    window.addEventListener("resize", this.fit, { signal });
    this.fit();
  }

  private readonly getContentSize: () => Vec2;
  private readonly insets: CameraFitInsetSource;

  readonly fit = () => {
    const [contentWidth, contentHeight] = this.getContentSize();
    const insets =
      typeof this.insets === "function" ? this.insets() : this.insets;
    this.camera.fit({
      viewportWidth: this.canvas.clientWidth,
      viewportHeight: this.canvas.clientHeight,
      contentWidth,
      contentHeight,
      insets,
    });
  };
}
