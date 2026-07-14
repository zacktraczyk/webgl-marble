import { EditorOverlay } from "../../editor/editorOverlay";
import { LevelEditorController } from "../../editor/levelEditorController";
import type { LevelObjectData } from "../../editor/levelDocument";
import type { Vec2 } from "../../engine/core/transform";
import Stage from "../../engine/stage";
import { MAX_TEAMS } from "../../game/race/staging";
import { AuthoredLevel } from "./authoredLevel";
import {
  MAX_STAGE_HEIGHT,
  MAX_STAGE_WIDTH,
  MIN_STAGE_HEIGHT,
  MIN_STAGE_WIDTH,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from "./constants";
import {
  createBumper,
  createCourseBoundaries,
  createDefaultCourse,
  createSpawnPoint,
  createWall,
} from "./courseObjects";
import { resolveBuilderUi, type BuilderUi } from "./elements";
import { GridOverlay } from "./gridOverlay";
import { updateBuilderInterface } from "./interfacePresenter";
import { RaceController } from "./raceController";
import {
  SelectedTool,
  type BuilderElements,
  type RoundConfiguration,
} from "./types";
import { clampInteger, snapToGrid } from "./utils";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;
const STAGE_FIT_PADDING = 128;

export class LevelBuilderRuntime {
  readonly stage: Stage;
  private readonly ui: BuilderUi;
  private readonly level: AuthoredLevel;
  private readonly race: RaceController;
  private readonly editorController: LevelEditorController;
  private readonly editorOverlay: EditorOverlay;
  private readonly gridOverlay: GridOverlay;
  private configuration: RoundConfiguration;
  private selectedTool = SelectedTool.Pointer;
  private playbackActive = false;

  constructor(selectors: BuilderElements, signal: AbortSignal) {
    this.ui = resolveBuilderUi(selectors);
    this.stage = new Stage({ width: STAGE_WIDTH, height: STAGE_HEIGHT });
    this.stage.centerCameraOnResize = true;
    this.stage.fitStageToWindowOnResizePadding = STAGE_FIT_PADDING;
    this.stage.fitStageToWindowOnResize = true;
    this.stage.fitStageToWindow(STAGE_FIT_PADDING);

    this.configuration = this.readRoundConfiguration();
    this.level = new AuthoredLevel(this.stage, this.configuration.teamCount);
    for (const object of createDefaultCourse(
      this.stage.width,
      this.stage.height
    )) {
      this.level.add(object);
    }

    this.race = new RaceController(this.stage, this.level, this.configuration);
    this.gridOverlay = new GridOverlay(
      this.stage,
      this.ui.majorGridToggleButton,
      this.ui.minorGridToggleButton,
      this.ui.gridOverlay
    );
    this.editorController = new LevelEditorController({
      stage: this.stage,
      getObjects: () => this.level.objects,
      callbacks: {
        onObjectChange: (object) => this.refreshAuthoredObject(object),
        onObjectCommit: () => this.race.reset(),
        onDelete: (object) => {
          this.level.remove(object.id);
          this.race.reset();
        },
      },
      signal,
    });
    this.editorOverlay = new EditorOverlay(
      this.ui.editorOverlayCanvas,
      this.stage
    );

    this.bindEventHandlers(signal);
    this.setActiveTool(SelectedTool.Pointer, this.ui.pointerButton);
    this.gridOverlay.update();
    this.race.reset();
  }

  fixedUpdate(deltaMs: number) {
    this.race.fixedUpdate(deltaMs);
  }

  updateInterface() {
    const race = this.race.snapshot;
    this.playbackActive = race.phase !== "ready";
    const spawnPoint = this.level.find("spawn-point");
    if (spawnPoint) {
      this.level.setVisible(spawnPoint.id, !this.playbackActive);
    }
    this.gridOverlay.setSuppressed(this.playbackActive);
    this.gridOverlay.update();
    this.updateViewportControls();
    updateBuilderInterface({
      ui: this.ui,
      configuration: this.configuration,
      race,
      authoredObjects: this.level.objects.length,
      selectedObject: this.editorController.selectedObject?.id ?? null,
      hoveredObject: this.editorController.hoveredObject?.id ?? null,
    });
  }

  render() {
    this.stage.render();
    const hoveredObject = this.editorController.hoveredObject;
    const selectedObject = this.editorController.selectedObject;
    this.editorOverlay.render({
      active: this.editorController.isActive,
      hoveredObject:
        this.playbackActive && hoveredObject?.prefab === "spawn-point"
          ? null
          : hoveredObject,
      selectedObject:
        this.playbackActive && selectedObject?.prefab === "spawn-point"
          ? null
          : selectedObject,
    });
  }

  dispose() {
    this.race.dispose();
    this.stage.dispose();
  }

  private bindEventHandlers(signal: AbortSignal) {
    const toolBindings: Array<[HTMLButtonElement, SelectedTool]> = [
      [this.ui.panButton, SelectedTool.Pan],
      [this.ui.pointerButton, SelectedTool.Pointer],
      [this.ui.wallButton, SelectedTool.Wall],
      [this.ui.bumperButton, SelectedTool.Bumper],
      [this.ui.spawnPointButton, SelectedTool.SpawnPoint],
    ];
    for (const [button, tool] of toolBindings) {
      button.addEventListener("click", () => this.setActiveTool(tool, button), {
        signal,
      });
    }

    this.ui.majorGridToggleButton.addEventListener(
      "click",
      () => this.gridOverlay.toggleMajor(),
      { signal }
    );
    this.ui.minorGridToggleButton.addEventListener(
      "click",
      () => this.gridOverlay.toggleMinor(),
      { signal }
    );
    this.stage.canvas.addEventListener("click", this.placeSelectedObject, {
      signal,
    });

    this.ui.teamCountInput.addEventListener(
      "input",
      this.handleRoundConfigurationChange,
      { signal }
    );
    this.ui.marblesPerTeamInput.addEventListener(
      "input",
      this.handleRoundConfigurationChange,
      { signal }
    );
    this.ui.releaseIntervalInput.addEventListener(
      "input",
      this.handleRoundConfigurationChange,
      { signal }
    );
    this.ui.courseWidthInput.addEventListener(
      "change",
      this.handleCourseSizeChange,
      { signal }
    );
    this.ui.courseHeightInput.addEventListener(
      "change",
      this.handleCourseSizeChange,
      { signal }
    );
    this.ui.playButton.addEventListener(
      "click",
      () => this.race.toggleRunning(),
      { signal }
    );
    this.ui.resetButton.addEventListener("click", () => this.race.reset(), {
      signal,
    });
    this.ui.zoomInButton.addEventListener(
      "click",
      () => this.adjustZoom(ZOOM_STEP),
      { signal }
    );
    this.ui.zoomOutButton.addEventListener(
      "click",
      () => this.adjustZoom(-ZOOM_STEP),
      { signal }
    );
    this.ui.zoomResetButton.addEventListener(
      "click",
      () => {
        this.stage.zoom = 1;
      },
      { signal }
    );
  }

  private setActiveTool(tool: SelectedTool, button: HTMLButtonElement) {
    this.selectedTool = tool;
    for (const toolButton of [
      this.ui.panButton,
      this.ui.pointerButton,
      this.ui.wallButton,
      this.ui.bumperButton,
      this.ui.spawnPointButton,
    ]) {
      toolButton.dataset.active = toolButton === button ? "true" : "false";
    }
    this.stage.panAndZoom = tool === SelectedTool.Pan;
    this.editorController.setActive(tool === SelectedTool.Pointer);
    this.stage.canvas.dataset.pointer =
      tool === SelectedTool.Pan
        ? "pan"
        : tool === SelectedTool.Pointer
          ? "select"
          : "shape";
  }

  private readonly placeSelectedObject = (event: MouseEvent) => {
    if (
      this.selectedTool === SelectedTool.Pan ||
      this.selectedTool === SelectedTool.Pointer
    ) {
      return;
    }

    const bounds = this.stage.canvas.getBoundingClientRect();
    const [worldX, worldY] = this.stage.screenToWorld(
      event.clientX - bounds.left,
      event.clientY - bounds.top
    );
    const position = snapToGrid([worldX, worldY]);

    switch (this.selectedTool) {
      case SelectedTool.Wall:
        this.level.add(createWall(position));
        break;
      case SelectedTool.Bumper:
        this.level.add(createBumper(position));
        break;
      case SelectedTool.SpawnPoint:
        this.level.replaceUnique("spawn-point", createSpawnPoint(position));
        this.race.reset();
        break;
    }
  };

  private refreshAuthoredObject(object: LevelObjectData) {
    this.level.refresh(object);
  }

  private adjustZoom(delta: number) {
    this.stage.zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, this.stage.zoom + delta)
    );
  }

  private updateViewportControls() {
    this.ui.zoomLevelOutput.value = `${Math.round(this.stage.zoom * 100)}%`;
    this.ui.zoomOutButton.disabled = this.stage.zoom <= MIN_ZOOM;
    this.ui.zoomInButton.disabled = this.stage.zoom >= MAX_ZOOM;
  }

  private readCourseSize(): Vec2 {
    return [
      clampInteger(
        this.ui.courseWidthInput.value,
        MIN_STAGE_WIDTH,
        MAX_STAGE_WIDTH
      ),
      clampInteger(
        this.ui.courseHeightInput.value,
        MIN_STAGE_HEIGHT,
        MAX_STAGE_HEIGHT
      ),
    ];
  }

  private readRoundConfiguration(): RoundConfiguration {
    return {
      teamCount: clampInteger(this.ui.teamCountInput.value, 1, MAX_TEAMS),
      marblesPerTeam: clampInteger(this.ui.marblesPerTeamInput.value, 1, 100),
      releaseIntervalMs: clampInteger(
        this.ui.releaseIntervalInput.value,
        50,
        1000
      ),
    };
  }

  private readonly handleRoundConfigurationChange = () => {
    this.configuration = this.readRoundConfiguration();
    this.race.setConfiguration(this.configuration);
  };

  private readonly handleCourseSizeChange = () => {
    const [width, height] = this.readCourseSize();
    this.ui.courseWidthInput.value = `${width}`;
    this.ui.courseHeightInput.value = `${height}`;
    if (width === this.stage.width && height === this.stage.height) {
      return;
    }

    this.stage.setSize(width, height);
    this.level.resize([width, height], createCourseBoundaries(width, height));
    this.stage.fitStageToWindow(STAGE_FIT_PADDING);
    this.race.reset();
  };
}
