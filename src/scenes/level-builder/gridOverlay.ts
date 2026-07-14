import type { Vec2 } from "../../engine/core/transform";
import type Stage from "../../engine/stage";
import { GRID_MAJOR_INTERVAL, GRID_SIZE } from "./constants";

export type GridWorldBounds = {
  min: Vec2;
  max: Vec2;
};

const positiveModulo = (value: number, divisor: number) =>
  ((value % divisor) + divisor) % divisor;

const centeredMajorOffset = (
  length: number,
  minorOffset: number,
  majorGridSize: number
) => {
  const target = positiveModulo(length, majorGridSize) / 2;
  return Array.from({ length: GRID_MAJOR_INTERVAL }, (_, index) =>
    positiveModulo(minorOffset + GRID_SIZE * index, majorGridSize)
  ).reduce((closest, candidate) =>
    Math.abs(candidate - target) < Math.abs(closest - target)
      ? candidate
      : closest
  );
};

export class GridOverlay {
  private majorVisible = true;
  private minorVisible = false;
  private suppressed = false;

  constructor(
    private readonly stage: Stage,
    private readonly majorToggleButton: HTMLButtonElement,
    private readonly minorToggleButton: HTMLButtonElement,
    private readonly overlay: HTMLElement,
    private readonly getWorldBounds?: () => GridWorldBounds
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

    const bounds = this.getWorldBounds?.() ?? {
      min: [-this.stage.width / 2, -this.stage.height / 2],
      max: [this.stage.width / 2, this.stage.height / 2],
    };
    const [left, top] = this.stage.worldToScreen(...bounds.min);
    const width = Math.max(0, bounds.max[0] - bounds.min[0]);
    const height = Math.max(0, bounds.max[1] - bounds.min[1]);
    const majorGridSize = GRID_SIZE * GRID_MAJOR_INTERVAL;
    const minorOffsetX = positiveModulo(-bounds.min[0], GRID_SIZE);
    const minorOffsetY = positiveModulo(-bounds.min[1], GRID_SIZE);
    const majorOffsetX = centeredMajorOffset(
      width,
      minorOffsetX,
      majorGridSize
    );
    const majorOffsetY = centeredMajorOffset(
      height,
      minorOffsetY,
      majorGridSize
    );

    this.overlay.style.left = `${left}px`;
    this.overlay.style.top = `${top}px`;
    this.overlay.style.width = `${width * this.stage.zoom}px`;
    this.overlay.style.height = `${height * this.stage.zoom}px`;
    this.overlay.style.setProperty(
      "--grid-step",
      `${GRID_SIZE * this.stage.zoom}px`
    );
    this.overlay.style.setProperty(
      "--grid-major-step",
      `${majorGridSize * this.stage.zoom}px`
    );
    this.overlay.style.setProperty(
      "--grid-minor-offset-x",
      `${minorOffsetX * this.stage.zoom}px`
    );
    this.overlay.style.setProperty(
      "--grid-minor-offset-y",
      `${minorOffsetY * this.stage.zoom}px`
    );
    this.overlay.style.setProperty(
      "--grid-major-offset-x",
      `${majorOffsetX * this.stage.zoom}px`
    );
    this.overlay.style.setProperty(
      "--grid-major-offset-y",
      `${majorOffsetY * this.stage.zoom}px`
    );
  }
}
