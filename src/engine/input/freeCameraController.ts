import type { Camera2D } from "../camera/camera2d";

export type FreeCameraControllerOptions = {
  signal: AbortSignal;
  minimumZoom?: number;
  maximumZoom?: number;
};

/** Adds opt-in pointer panning and cursor-centered wheel zoom to a camera. */
export class FreeCameraController {
  private readonly minimumZoom: number;
  private readonly maximumZoom: number;
  private pointerId: number | null = null;
  private lastScreen: [number, number] | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera2D,
    { signal, minimumZoom = 0.1, maximumZoom = 4 }: FreeCameraControllerOptions
  ) {
    this.minimumZoom = minimumZoom;
    this.maximumZoom = maximumZoom;
    canvas.addEventListener("pointerdown", this.pointerDown, { signal });
    canvas.addEventListener("pointermove", this.pointerMove, { signal });
    canvas.addEventListener("pointerup", this.pointerUp, { signal });
    canvas.addEventListener("pointercancel", this.pointerUp, { signal });
    canvas.addEventListener("wheel", this.wheel, { signal, passive: false });
    signal.addEventListener("abort", this.cancel, { once: true });
  }

  private readonly pointerDown = (event: PointerEvent) => {
    if (event.defaultPrevented || (event.button !== 0 && event.button !== 1)) {
      return;
    }
    this.pointerId = event.pointerId;
    this.lastScreen = [event.clientX, event.clientY];
    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private readonly pointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId || !this.lastScreen) {
      return;
    }
    this.camera.panByScreen(
      event.clientX - this.lastScreen[0],
      event.clientY - this.lastScreen[1]
    );
    this.lastScreen = [event.clientX, event.clientY];
    event.preventDefault();
  };

  private readonly pointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.pointerId = null;
    this.lastScreen = null;
  };

  private readonly cancel = () => {
    if (
      this.pointerId !== null &&
      this.canvas.hasPointerCapture(this.pointerId)
    ) {
      this.canvas.releasePointerCapture(this.pointerId);
    }
    this.pointerId = null;
    this.lastScreen = null;
  };

  private readonly wheel = (event: WheelEvent) => {
    const bounds = this.canvas.getBoundingClientRect();
    const zoom = Math.min(
      this.maximumZoom,
      Math.max(
        this.minimumZoom,
        this.camera.zoom * Math.exp(-event.deltaY * 0.002)
      )
    );
    this.camera.zoomAtScreenPoint(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      zoom
    );
    event.preventDefault();
  };
}
