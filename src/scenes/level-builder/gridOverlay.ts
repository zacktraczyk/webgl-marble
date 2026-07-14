import type Stage from "../../engine/stage";
import { GRID_SIZE } from "./constants";

export class GridOverlay {
  private visible = true;

  constructor(
    private readonly stage: Stage,
    private readonly toggleButton: HTMLButtonElement,
    private readonly overlay: HTMLElement
  ) {}

  toggle() {
    this.visible = !this.visible;
    this.update();
  }

  update() {
    this.toggleButton.ariaChecked = `${this.visible}`;
    this.toggleButton.dataset.active = `${this.visible}`;
    this.overlay.hidden = !this.visible;

    const [left, top] = this.stage.worldToScreen(
      -this.stage.width / 2,
      -this.stage.height / 2
    );
    this.overlay.style.left = `${left}px`;
    this.overlay.style.top = `${top}px`;
    this.overlay.style.width = `${this.stage.width * this.stage.zoom}px`;
    this.overlay.style.height = `${this.stage.height * this.stage.zoom}px`;
    this.overlay.style.setProperty(
      "--grid-step",
      `${GRID_SIZE * this.stage.zoom}px`
    );
    this.overlay.style.setProperty(
      "--grid-major-step",
      `${GRID_SIZE * 4 * this.stage.zoom}px`
    );
  }
}
