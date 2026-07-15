import type { PusherSpeed } from "../level/objects";
import { isPusherTool, SelectedTool } from "../types";
import type { BuilderUi } from ".";

export type BuilderControlActions = {
  selectTool(tool: SelectedTool): void;
  toggleMajorGrid(): void;
  toggleMinorGrid(): void;
  toggleGridSnap(): void;
  changeRoundConfiguration(): void;
  changeCourseSize(): void;
  changeWallThickness(): void;
  changeMotionType(): void;
  inputMotionRange(): void;
  commitMotionRange(): void;
  reverseMotion(): void;
  setMotionSpeed(speed: PusherSpeed): void;
  toggleRace(): void;
  resetRace(): void;
  undo(): void;
  redo(): void;
  adjustZoom(delta: number): void;
  resetZoom(): void;
};

const ZOOM_STEP = 0.1;

const releasePointerFocus = (event: MouseEvent) => {
  if (event.detail > 0 && event.currentTarget instanceof HTMLButtonElement) {
    event.currentTarget.blur();
  }
};

/** Owns builder DOM events and transient control presentation. */
export class BuilderControls {
  private readonly buttonByTool: ReadonlyMap<SelectedTool, HTMLButtonElement>;

  constructor(
    private readonly ui: BuilderUi,
    actions: BuilderControlActions,
    signal: AbortSignal
  ) {
    this.buttonByTool = new Map<SelectedTool, HTMLButtonElement>([
      [SelectedTool.Pan, ui.panButton],
      [SelectedTool.Pointer, ui.pointerButton],
      [SelectedTool.Wall, ui.wallButton],
      [SelectedTool.SpawnPoint, ui.spawnPointButton],
      [SelectedTool.Slider, ui.sliderButton],
      [SelectedTool.Spinner, ui.spinnerButton],
      [SelectedTool.Sweeper, ui.sweeperButton],
    ]);

    for (const [tool, button] of this.buttonByTool) {
      button.addEventListener(
        "click",
        (event) => {
          actions.selectTool(tool);
          releasePointerFocus(event);
        },
        { signal }
      );
    }

    ui.pusherMenuToggleButton.addEventListener(
      "click",
      (event) => {
        this.setPusherLibraryOpen(ui.pusherLibrary.hidden);
        releasePointerFocus(event);
      },
      { signal }
    );
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (
          !ui.pusherLibrary.hidden &&
          !ui.pusherLibrary.contains(event.target as Node) &&
          !ui.pusherMenuToggleButton.contains(event.target as Node)
        ) {
          this.setPusherLibraryOpen(false);
        }
      },
      { signal }
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && !ui.pusherLibrary.hidden) {
          this.setPusherLibraryOpen(false);
          ui.pusherMenuToggleButton.focus();
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { signal }
    );

    ui.majorGridToggleButton.addEventListener(
      "click",
      actions.toggleMajorGrid,
      {
        signal,
      }
    );
    ui.minorGridToggleButton.addEventListener(
      "click",
      actions.toggleMinorGrid,
      {
        signal,
      }
    );
    ui.gridSnapToggleButton.addEventListener("click", actions.toggleGridSnap, {
      signal,
    });
    ui.teamCountInput.addEventListener(
      "input",
      actions.changeRoundConfiguration,
      { signal }
    );
    ui.marblesPerTeamInput.addEventListener(
      "input",
      actions.changeRoundConfiguration,
      { signal }
    );
    ui.releaseIntervalInput.addEventListener(
      "input",
      actions.changeRoundConfiguration,
      { signal }
    );
    ui.courseWidthInput.addEventListener("change", actions.changeCourseSize, {
      signal,
    });
    ui.courseHeightInput.addEventListener("change", actions.changeCourseSize, {
      signal,
    });
    ui.wallThicknessInput.addEventListener(
      "change",
      actions.changeWallThickness,
      { signal }
    );
    ui.motionTypeSelect.addEventListener("change", actions.changeMotionType, {
      signal,
    });
    ui.motionRangeInput.addEventListener("input", actions.inputMotionRange, {
      signal,
    });
    ui.motionRangeInput.addEventListener("change", actions.commitMotionRange, {
      signal,
    });
    ui.motionReverseButton.addEventListener("click", actions.reverseMotion, {
      signal,
    });
    for (const button of ui.motionSpeedButtons) {
      button.addEventListener(
        "click",
        () => {
          const speed = button.dataset.speed as PusherSpeed | undefined;
          if (speed) {
            actions.setMotionSpeed(speed);
          }
        },
        { signal }
      );
    }
    ui.playButton.addEventListener("click", actions.toggleRace, { signal });
    ui.resetButton.addEventListener("click", actions.resetRace, { signal });
    ui.undoButton.addEventListener("click", actions.undo, { signal });
    ui.redoButton.addEventListener("click", actions.redo, { signal });
    ui.zoomInButton.addEventListener(
      "click",
      () => actions.adjustZoom(ZOOM_STEP),
      { signal }
    );
    ui.zoomOutButton.addEventListener(
      "click",
      () => actions.adjustZoom(-ZOOM_STEP),
      { signal }
    );
    ui.zoomResetButton.addEventListener("click", actions.resetZoom, { signal });
  }

  showSelectedTool(tool: SelectedTool) {
    for (const button of this.buttonByTool.values()) {
      button.dataset.active = `${button === this.buttonByTool.get(tool)}`;
    }
    this.ui.pusherMenuToggleButton.dataset.active = `${isPusherTool(tool)}`;
    if (isPusherTool(tool)) {
      this.setPusherLibraryOpen(false);
    }
  }

  showGridSnapEnabled(enabled: boolean) {
    this.ui.gridSnapToggleButton.dataset.active = `${enabled}`;
    this.ui.gridSnapToggleButton.ariaChecked = `${enabled}`;
  }

  setPusherLibraryOpen(open: boolean) {
    this.ui.pusherLibrary.hidden = !open;
    this.ui.pusherMenuToggleButton.ariaExpanded = `${open}`;
  }
}
