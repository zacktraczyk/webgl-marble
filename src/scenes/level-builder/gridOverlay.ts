import type Stage from "../../engine/stage";
import { STAGING_RACK_HEIGHT } from "../../game/prefabs/stagingRack";
import { GRID_MAJOR_INTERVAL, GRID_SIZE } from "./constants";

export class GridOverlay {
  private majorVisible = true;
  private minorVisible = false;
  private suppressed = false;

  constructor(
    private readonly stage: Stage,
    private readonly majorToggleButton: HTMLButtonElement,
    private readonly minorToggleButton: HTMLButtonElement,
    private readonly overlay: HTMLElement
  ) {}

  toggleMajor() {
    this.majorVisible = !this.majorVisible;
    this.update();
  }

  toggleMinor() {
    this.minorVisible = !this.minorVisible;
    this.update();
  }

  setSuppressed(suppressed: boolean) {
    this.suppressed = suppressed;
  }

  update() {
    this.majorToggleButton.ariaChecked = `${this.majorVisible}`;
    this.majorToggleButton.dataset.active = `${this.majorVisible}`;
    this.minorToggleButton.ariaChecked = `${this.minorVisible}`;
    this.minorToggleButton.dataset.active = `${this.minorVisible}`;
    this.overlay.dataset.majorVisible = `${this.majorVisible}`;
    this.overlay.dataset.minorVisible = `${this.minorVisible}`;
    this.overlay.hidden =
      (!this.majorVisible && !this.minorVisible) || this.suppressed;

    const [left, top] = this.stage.worldToScreen(
      -this.stage.width / 2,
      -this.stage.height / 2
    );
    this.overlay.style.left = `${left}px`;
    this.overlay.style.top = `${top}px`;
    this.overlay.style.width = `${this.stage.width * this.stage.zoom}px`;
    this.overlay.style.height = `${this.stage.height * this.stage.zoom}px`;
    this.overlay.style.clipPath = `inset(${STAGING_RACK_HEIGHT * this.stage.zoom}px 0 0 0)`;
    this.overlay.style.setProperty(
      "--grid-step",
      `${GRID_SIZE * this.stage.zoom}px`
    );
    this.overlay.style.setProperty(
      "--grid-major-step",
      `${GRID_SIZE * GRID_MAJOR_INTERVAL * this.stage.zoom}px`
    );
  }
}
