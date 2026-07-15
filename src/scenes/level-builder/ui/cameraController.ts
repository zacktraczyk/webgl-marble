import { CameraResizeController } from "../../../engine/camera/resizeController";
import type { CameraFitInsets } from "../../../engine/camera/fit";
import type { Vec2 } from "../../../engine/core/transform";
import type Stage from "../../../engine/stage";
import type { BuilderUi } from ".";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

/** Owns builder camera policy, controls, and UI-aware viewport fitting. */
export class BuilderCameraController {
  private readonly resizeController: CameraResizeController;

  constructor(
    private readonly stage: Stage,
    private readonly ui: BuilderUi,
    signal: AbortSignal
  ) {
    this.resizeController = new CameraResizeController(
      stage.canvas,
      stage.camera,
      {
        getContentSize: () => [stage.width, stage.height],
        insets: this.getFitInsets,
        signal,
      }
    );
  }

  adjustZoom(delta: number) {
    this.setZoomAtCanvasCenter(
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.stage.camera.zoom + delta))
    );
  }

  resetZoom() {
    this.setZoomAtCanvasCenter(1);
  }

  panByScreen(deltaX: number, deltaY: number) {
    this.stage.camera.panByScreen(deltaX, deltaY);
  }

  handleWheel(screenPoint: Vec2, event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      const zoom = Math.min(
        MAX_ZOOM,
        Math.max(
          MIN_ZOOM,
          this.stage.camera.zoom * Math.exp(-event.deltaY * 0.002)
        )
      );
      this.stage.camera.zoomAtScreenPoint(...screenPoint, zoom);
    } else {
      this.stage.camera.panByScreen(-event.deltaX, -event.deltaY);
    }
  }

  fitStage() {
    this.resizeController.fit();
  }

  updateControls() {
    this.ui.zoomLevelOutput.value = `${Math.round(this.stage.camera.zoom * 100)}%`;
    this.ui.zoomOutButton.disabled = this.stage.camera.zoom <= MIN_ZOOM;
    this.ui.zoomInButton.disabled = this.stage.camera.zoom >= MAX_ZOOM;
  }

  private readonly getFitInsets = (): CameraFitInsets => {
    const canvasBounds = this.stage.canvas.getBoundingClientRect();
    const toolbarBounds = this.ui.toolbar.getBoundingClientRect();
    const toolHintBounds = this.ui.toolHintOutput.getBoundingClientRect();
    const raceControlBounds = this.ui.raceControls.getBoundingClientRect();
    const margin = Math.max(0, toolbarBounds.top - canvasBounds.top);
    const toolbarInset = margin + toolbarBounds.height + margin;
    const toolHintInset = toolHintBounds.bottom - canvasBounds.top + margin;

    return {
      top: Math.max(toolbarInset, toolHintInset),
      right: margin,
      bottom: margin + raceControlBounds.height + margin,
      left: margin,
    };
  };

  private setZoomAtCanvasCenter(zoom: number) {
    this.stage.camera.zoomAtScreenPoint(
      this.stage.canvas.clientWidth / 2,
      this.stage.canvas.clientHeight / 2,
      zoom
    );
  }
}
