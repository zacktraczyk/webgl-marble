import { EditorOverlay } from "../../editor/editorOverlay";
import { LevelEditorController } from "../../editor/levelEditorController";
import type { LevelObjectData } from "../../editor/levelDocument";
import type { Vec2 } from "../../engine/core/transform";
import Stage from "../../engine/stage";
import { MAX_TEAMS } from "../../game/race/staging";
import { AuthoredLevel } from "./authoredLevel";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./constants";
import {
  createBumper,
  createDefaultCourse,
  createSpawnPoint,
  createStagingRack,
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

  constructor(selectors: BuilderElements, signal: AbortSignal) {
    this.ui = resolveBuilderUi(selectors);
    this.stage = new Stage({ width: STAGE_WIDTH, height: STAGE_HEIGHT });
    this.stage.centerCameraOnResize = true;
    this.stage.fitStageToWindowOnResizePadding = 64;
    this.stage.fitStageToWindowOnResize = true;
    this.stage.fitStageToWindow(64);

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
      this.ui.gridToggleButton,
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
    this.gridOverlay.update();
    updateBuilderInterface({
      ui: this.ui,
      configuration: this.configuration,
      race: this.race.snapshot,
      authoredObjects: this.level.objects.length,
      selectedObject: this.editorController.selectedObject?.id ?? null,
      hoveredObject: this.editorController.hoveredObject?.id ?? null,
    });
  }

  render() {
    this.stage.render();
    this.editorOverlay.render({
      active: this.editorController.isActive,
      hoveredObject: this.editorController.hoveredObject,
      selectedObject: this.editorController.selectedObject,
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
      [this.ui.stagingRackButton, SelectedTool.StagingRack],
      [this.ui.spawnPointButton, SelectedTool.SpawnPoint],
    ];
    for (const [button, tool] of toolBindings) {
      button.addEventListener("click", () => this.setActiveTool(tool, button), {
        signal,
      });
    }

    this.ui.gridToggleButton.addEventListener(
      "click",
      () => this.gridOverlay.toggle(),
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
    this.ui.playButton.addEventListener(
      "click",
      () => this.race.toggleRunning(),
      { signal }
    );
    this.ui.resetButton.addEventListener("click", () => this.race.reset(), {
      signal,
    });
  }

  private setActiveTool(tool: SelectedTool, button: HTMLButtonElement) {
    this.selectedTool = tool;
    for (const toolButton of [
      this.ui.panButton,
      this.ui.pointerButton,
      this.ui.wallButton,
      this.ui.bumperButton,
      this.ui.stagingRackButton,
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
      case SelectedTool.StagingRack:
        this.level.replaceUnique("staging-rack", createStagingRack(position));
        this.race.reset();
        break;
      case SelectedTool.SpawnPoint:
        this.level.replaceUnique("spawn-point", createSpawnPoint(position));
        this.race.reset();
        break;
    }
  };

  private refreshAuthoredObject(object: LevelObjectData) {
    const previousPosition = this.level.refresh(object);
    if (object.prefab === "staging-rack" && previousPosition) {
      const delta: Vec2 = [
        object.transform.position[0] - previousPosition[0],
        object.transform.position[1] - previousPosition[1],
      ];
      this.race.translateStagedMarbles(delta);
    }
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
}
