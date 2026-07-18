import { getLevelObjectBounds } from "../../editor/levelGeometry";
import { EditorOverlay, LevelEditorController } from "../../editor/levelEditor";
import { LevelHistory } from "../../editor/levelHistory";
import type {
  LevelObjectData,
  SerializedLevel,
} from "../../editor/levelDocument";
import Stage from "../../engine/stage";
import { createGridLayout, type GridWorldBounds } from "./grid";
import { AuthoredLevel } from "./level";
import { BuilderCameraController } from "./ui/cameraController";
import { BuilderControls } from "./ui/controls";
import {
  readCourseSize,
  readRoundConfiguration,
  readWallThickness,
} from "./ui/settings";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./constants";
import {
  createCourseBoundaries,
  createDefaultCourse,
  createPusher,
  createSpawnPoint,
  createWall,
} from "./level/objects";
import { RaceController } from "./race";
import { resolveBuilderUi, type BuilderUi } from "./ui";
import { GridOverlay } from "./ui/gridOverlay";
import { MotionInspectorController } from "./ui/motionInspector";
import { updateBuilderInterface } from "./ui/presenter";
import { TooltipController } from "../../components/tooltip";
import {
  isCreationTool,
  isPusherTool,
  SelectedTool,
  type RoundConfiguration,
} from "./types";

export type LevelBuilderOptions = {
  initialLevel?: SerializedLevel;
  roundConfiguration?: RoundConfiguration;
  onCommit?: (level: SerializedLevel) => void;
};

export class LevelBuilderRuntime {
  private readonly stage: Stage;
  private readonly ui: BuilderUi;
  private readonly level: AuthoredLevel;
  private readonly race: RaceController;
  private readonly history: LevelHistory;
  private readonly editorController: LevelEditorController;
  private readonly editorOverlay: EditorOverlay;
  private readonly gridOverlay: GridOverlay;
  private readonly controls: BuilderControls;
  private readonly cameraController: BuilderCameraController;
  private readonly motionInspector: MotionInspectorController;
  private readonly onCommit: LevelBuilderOptions["onCommit"];
  private configuration: RoundConfiguration;
  /**
   * Era finish plan handed in by the leg builder. The settings inputs cannot
   * express it, so it is re-merged whenever the configuration is re-read.
   */
  private readonly finishPlan: RoundConfiguration["finishPlan"];
  private selectedTool = SelectedTool.Pointer;
  private gridSnapEnabled = true;
  private playbackActive = false;

  constructor(
    rootElement: HTMLElement | null,
    signal: AbortSignal,
    options: LevelBuilderOptions = {}
  ) {
    // DOM and engine
    this.ui = resolveBuilderUi(rootElement);
    this.onCommit = options.onCommit;
    if (options.initialLevel) {
      this.syncLevelInputs(options.initialLevel);
    }
    if (options.roundConfiguration) {
      this.syncRoundConfigurationInputs(options.roundConfiguration);
    }
    this.finishPlan = options.roundConfiguration?.finishPlan;
    new TooltipController(this.ui, signal);
    this.stage = new Stage({
      width: options.initialLevel?.size[0] ?? STAGE_WIDTH,
      height: options.initialLevel?.size[1] ?? STAGE_HEIGHT,
    });
    this.cameraController = new BuilderCameraController(
      this.stage,
      this.ui,
      signal
    );

    // Level and race state
    this.configuration = {
      ...readRoundConfiguration(this.ui),
      finishPlan: this.finishPlan,
    };
    this.level = this.createLevel(options.initialLevel);
    this.race = new RaceController(this.stage, this.level, this.configuration);
    this.history = new LevelHistory(this.level.document.serialize());

    // Editor layers
    this.gridOverlay = this.createGridOverlay();
    this.editorController = this.createEditorController(signal);
    this.editorOverlay = new EditorOverlay(
      this.ui.editorOverlayCanvas,
      this.stage
    );
    this.motionInspector = this.createMotionInspector();

    // User actions
    this.controls = this.createControls(signal);

    // Initial view
    this.initializeView();
  }

  private createLevel(initialLevel?: SerializedLevel) {
    const wallThickness =
      initialLevel?.settings.wallThickness ?? readWallThickness(this.ui);
    const level = new AuthoredLevel(
      this.stage,
      this.configuration,
      wallThickness
    );
    if (initialLevel) {
      level.restore(initialLevel);
      return level;
    }
    for (const object of createDefaultCourse(
      this.stage.width,
      this.stage.height,
      wallThickness,
      this.configuration
    )) {
      level.add(object);
    }
    return level;
  }

  private createGridOverlay() {
    return new GridOverlay(
      this.stage,
      this.ui.majorGridToggleButton,
      this.ui.minorGridToggleButton,
      this.ui.gridOverlay,
      this.getGridWorldBounds
    );
  }

  private createEditorController(signal: AbortSignal) {
    return new LevelEditorController({
      stage: this.stage,
      cameraControls: this.cameraController,
      getObjects: () => this.level.objects,
      getDefaultWallThickness: () => this.level.wallThickness,
      getGridSnapEnabled: () => this.gridSnapEnabled,
      getGridLayout: () => createGridLayout(this.getGridWorldBounds()),
      callbacks: {
        onObjectsChange: (objects) => this.refreshAuthoredObjects(objects),
        onObjectsCommit: () => this.commitLevelChange(),
        onDelete: (objects) => {
          for (const object of objects) {
            this.level.remove(object.id);
          }
          this.commitLevelChange();
        },
        onCreateWall: (start, end) => {
          const object = this.level.add(createWall(start, end));
          this.commitLevelChange();
          return object;
        },
        onPlaceObject: (tool, position) => {
          let object: LevelObjectData;
          if (isPusherTool(tool)) {
            object = this.level.add(createPusher(tool, position));
          } else {
            object = this.level.replaceUnique(
              "spawn-point",
              createSpawnPoint(position)
            );
          }
          this.commitLevelChange();
          return object;
        },
        onToolRequest: (tool) => this.setActiveTool(tool),
        onToolComplete: (tool) => {
          if (tool === SelectedTool.SpawnPoint || isPusherTool(tool)) {
            this.setActiveTool(SelectedTool.Pointer);
          }
        },
        onUndo: () => this.undo(),
        onRedo: () => this.redo(),
        onReset: () => this.resetRace(),
      },
      signal,
    });
  }

  private createMotionInspector() {
    return new MotionInspectorController(
      this.ui,
      this.editorController,
      this.level,
      () => this.playbackActive,
      () => this.commitLevelChange()
    );
  }

  private createControls(signal: AbortSignal) {
    return new BuilderControls(
      this.ui,
      {
        selectTool: (tool) => this.setActiveTool(tool),
        toggleMajorGrid: () => this.gridOverlay.toggleMajor(),
        toggleMinorGrid: () => this.gridOverlay.toggleMinor(),
        toggleGridSnap: this.toggleGridSnap,
        changeRoundConfiguration: this.handleRoundConfigurationChange,
        changeCourseSize: this.handleCourseSizeChange,
        changeWallThickness: this.handleWallThicknessChange,
        changeMotionType: this.motionInspector.changeType,
        inputMotionRange: this.motionInspector.inputRange,
        commitMotionRange: this.motionInspector.commitRange,
        reverseMotion: this.motionInspector.reverse,
        setMotionSpeed: this.motionInspector.setSpeed,
        toggleRace: this.toggleRace,
        resetRace: this.resetRace,
        undo: () => this.undo(),
        redo: () => this.redo(),
        adjustZoom: (delta) => this.cameraController.adjustZoom(delta),
        resetZoom: () => this.cameraController.resetZoom(),
      },
      signal
    );
  }

  private initializeView() {
    this.setActiveTool(SelectedTool.Pointer);
    this.controls.showGridSnapEnabled(this.gridSnapEnabled);
    this.gridOverlay.update();
    this.race.reset();
  }

  fixedUpdate(deltaMs: number) {
    this.race.fixedUpdate(deltaMs);
  }

  get levelSnapshot(): SerializedLevel {
    return this.level.document.serialize();
  }

  updateInterface() {
    const race = this.race.snapshot;
    this.syncPlaybackState(race.phase !== "ready");
    const spawnPoint = this.level.find("spawn-point");
    if (spawnPoint) {
      this.level.setVisible(spawnPoint.id, !this.playbackActive);
    }
    this.gridOverlay.setSuppressed(this.playbackActive);
    this.gridOverlay.update();
    this.cameraController.updateControls();
    updateBuilderInterface({
      ui: this.ui,
      configuration: this.configuration,
      race,
      authoredObjects: this.level.objects.length,
      selectedObjects: this.editorController.selectedObjects.map(
        (object) => object.id
      ),
      selectedObject: this.editorController.selectedObject,
      hoveredObject: this.editorController.hoveredObject?.id ?? null,
      wallThickness: this.level.wallThickness,
      selectedTool: this.selectedTool,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    });
  }

  render() {
    this.stage.render();
    const hoveredObject = this.editorController.hoveredObject;
    const selectedObjects = this.editorController.selectedObjects.filter(
      (object) => !(this.playbackActive && object.prefab === "spawn-point")
    );
    const pusherPlacement = this.editorController.pusherPlacementPreview;
    const pusherDraft = pusherPlacement
      ? ({
          ...createPusher(pusherPlacement.tool, pusherPlacement.position),
          id: "pusher-placement-preview",
        } as LevelObjectData)
      : null;
    this.editorOverlay.render({
      active: this.editorController.isActive,
      readOnly: this.playbackActive,
      defaultWallThickness: this.level.wallThickness,
      hoveredObject:
        this.playbackActive && hoveredObject?.prefab === "spawn-point"
          ? null
          : hoveredObject,
      selectedObjects,
      wallDraft: this.editorController.wallDraft,
      pusherDraft,
      wallEndpointFeedback: this.editorController.wallEndpointFeedback,
      selectionMarquee: this.editorController.selectionMarquee,
    });
  }

  dispose() {
    this.race.dispose();
    this.stage.dispose();
  }

  private setActiveTool(tool: SelectedTool) {
    if (this.playbackActive && isCreationTool(tool)) {
      return;
    }
    this.selectedTool = tool;
    this.controls.showSelectedTool(tool);
    this.editorController.setActiveTool(tool);
    this.stage.canvas.dataset.pointer =
      tool === SelectedTool.Pan
        ? "pan"
        : tool === SelectedTool.Pointer
          ? "select"
          : "shape";
  }

  private readonly toggleGridSnap = () => {
    this.gridSnapEnabled = !this.gridSnapEnabled;
    this.controls.showGridSnapEnabled(this.gridSnapEnabled);
  };

  private refreshAuthoredObjects(objects: readonly LevelObjectData[]) {
    for (const object of objects) {
      this.level.refresh(object);
    }
  }

  private commitLevelChange() {
    this.race.reset();
    const snapshot = this.levelSnapshot;
    if (this.history.record(snapshot)) {
      this.onCommit?.(snapshot);
    }
  }

  private undo() {
    if (this.playbackActive) {
      return;
    }
    const snapshot = this.history.undo();
    if (snapshot) {
      this.restoreLevel(snapshot);
      this.onCommit?.(this.levelSnapshot);
    }
  }

  private redo() {
    if (this.playbackActive) {
      return;
    }
    const snapshot = this.history.redo();
    if (snapshot) {
      this.restoreLevel(snapshot);
      this.onCommit?.(this.levelSnapshot);
    }
  }

  private restoreLevel(snapshot: SerializedLevel) {
    const sizeChanged =
      snapshot.size[0] !== this.stage.width ||
      snapshot.size[1] !== this.stage.height;
    this.stage.setSize(...snapshot.size);
    this.level.restore(snapshot);
    this.editorController.clearSelection();
    this.ui.courseWidthInput.value = `${snapshot.size[0]}`;
    this.ui.courseHeightInput.value = `${snapshot.size[1]}`;
    this.ui.wallThicknessInput.value = `${snapshot.settings.wallThickness}`;
    if (sizeChanged) {
      this.cameraController.fitStage();
    }
    this.race.reset();
  }

  private syncLevelInputs(level: SerializedLevel) {
    this.ui.courseWidthInput.value = `${level.size[0]}`;
    this.ui.courseHeightInput.value = `${level.size[1]}`;
    this.ui.wallThicknessInput.value = `${level.settings.wallThickness}`;
  }

  private syncRoundConfigurationInputs(configuration: RoundConfiguration) {
    this.ui.teamCountInput.value = `${configuration.teamCount}`;
    this.ui.marblesPerTeamInput.value = `${configuration.marblesPerTeam}`;
    this.ui.releaseIntervalInput.value = `${configuration.releaseIntervalMs}`;
  }

  private readonly getGridWorldBounds = (): GridWorldBounds => {
    const boundaryWalls = this.level.objects
      .filter(
        (object): object is Extract<LevelObjectData, { prefab: "wall" }> =>
          object.prefab === "wall" && Boolean(object.locked)
      )
      .map((object) => ({
        object,
        bounds: getLevelObjectBounds(object, this.level.wallThickness),
      }));
    const boundaryWallBounds = boundaryWalls
      .filter(({ object }) => {
        const { start, end } = object.properties;
        return Math.abs(end[1] - start[1]) >= Math.abs(end[0] - start[0]);
      })
      .map(({ bounds }) => bounds)
      .sort((first, second) => first.min[0] - second.min[0]);
    const topWall = boundaryWalls
      .filter(({ object }) => {
        const { start, end } = object.properties;
        return Math.abs(end[0] - start[0]) > Math.abs(end[1] - start[1]);
      })
      .map(({ bounds }) => bounds)
      .sort((first, second) => first.min[1] - second.min[1])[0];
    const leftWall = boundaryWallBounds[0];
    const rightWall = boundaryWallBounds[boundaryWallBounds.length - 1];
    const rack = this.level.find("staging-rack");
    const finish = this.level.find("finish-zone");
    const rackBounds = rack
      ? getLevelObjectBounds(rack, this.level.wallThickness)
      : null;
    const finishBounds = finish
      ? getLevelObjectBounds(finish, this.level.wallThickness)
      : null;

    return {
      min: [
        leftWall?.max[0] ?? -this.stage.width / 2,
        rackBounds?.max[1] ?? topWall?.max[1] ?? -this.stage.height / 2,
      ],
      max: [
        rightWall?.min[0] ?? this.stage.width / 2,
        finishBounds?.min[1] ?? this.stage.height / 2,
      ],
    };
  };

  private syncPlaybackState(playbackActive: boolean) {
    if (this.playbackActive === playbackActive) {
      return;
    }
    this.playbackActive = playbackActive;
    this.ui.root.dataset.previewing = `${playbackActive}`;
    this.editorController.setReadOnly(playbackActive);
    if (playbackActive) {
      this.controls.setPusherLibraryOpen(false);
      this.editorController.clearSelection();
      this.setActiveTool(SelectedTool.Pan);
    } else {
      this.setActiveTool(SelectedTool.Pointer);
    }
  }

  private readonly handleRoundConfigurationChange = () => {
    this.configuration = {
      ...readRoundConfiguration(this.ui),
      finishPlan: this.finishPlan,
    };
    this.race.setConfiguration(this.configuration);
  };

  private readonly handleCourseSizeChange = () => {
    const [width, height] = readCourseSize(this.ui);
    this.ui.courseWidthInput.value = `${width}`;
    this.ui.courseHeightInput.value = `${height}`;
    if (width === this.stage.width && height === this.stage.height) {
      return;
    }
    this.stage.setSize(width, height);
    this.level.resize(
      [width, height],
      createCourseBoundaries(
        width,
        height,
        this.level.wallThickness,
        this.configuration
      )
    );
    this.cameraController.fitStage();
    this.commitLevelChange();
  };

  private readonly handleWallThicknessChange = () => {
    const wallThickness = readWallThickness(this.ui);
    this.ui.wallThicknessInput.value = `${wallThickness}`;
    if (wallThickness === this.level.wallThickness) {
      return;
    }
    this.level.setWallThickness(wallThickness);
    this.level.resize(
      [this.stage.width, this.stage.height],
      createCourseBoundaries(
        this.stage.width,
        this.stage.height,
        wallThickness,
        this.configuration
      )
    );
    this.commitLevelChange();
  };

  private readonly toggleRace = () => {
    this.race.toggleRunning();
    this.syncPlaybackState(this.race.snapshot.phase !== "ready");
  };

  private readonly resetRace = () => {
    this.race.reset();
    this.syncPlaybackState(false);
  };
}
