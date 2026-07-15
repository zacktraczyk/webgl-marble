import type Stage from "../../engine/stage";
import type { StageFitInsets } from "../../engine/stage/fit";
import type { BuilderUi } from "./elements";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

/** Owns builder camera controls and UI-aware stage fitting. */
export class BuilderViewport {
  constructor(
    private readonly stage: Stage,
    private readonly ui: BuilderUi
  ) {}

  adjustZoom(delta: number) {
    this.setZoomAtCanvasCenter(
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.stage.zoom + delta))
    );
  }

  resetZoom() {
    this.setZoomAtCanvasCenter(1);
  }

  updateControls() {
    this.ui.zoomLevelOutput.value = `${Math.round(this.stage.zoom * 100)}%`;
    this.ui.zoomOutButton.disabled = this.stage.zoom <= MIN_ZOOM;
    this.ui.zoomInButton.disabled = this.stage.zoom >= MAX_ZOOM;
  }

  readonly getFitInsets = (): StageFitInsets => {
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
    this.stage.zoomAtScreenPoint(
      this.stage.canvas.clientWidth / 2,
      this.stage.canvas.clientHeight / 2,
      zoom
    );
  }
}
