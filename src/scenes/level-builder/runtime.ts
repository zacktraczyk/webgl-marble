import { EditorOverlay } from "../../editor/editorOverlay";
import {
  getLevelObjectBounds,
  getLevelObjectShape,
} from "../../editor/levelGeometry";
import { LevelEditorController } from "../../editor/levelEditorController";
import { LevelHistory } from "../../editor/levelHistory";
import type {
  LevelObjectData,
  LevelObjectMotion,
  SerializedLevel,
} from "../../editor/levelDocument";
import type { Vec2 } from "../../engine/core/transform";
import Stage from "../../engine/stage";
import type { StageFitInsets } from "../../engine/stage/fit";
import { MAX_TEAMS } from "../../game/race/staging";
import { AuthoredLevel } from "./authoredLevel";
import {
  COURSE_STROKE_WIDTH,
  MAX_STAGE_HEIGHT,
  MAX_STAGE_WIDTH,
  MAX_WALL_THICKNESS,
  MIN_STAGE_HEIGHT,
  MIN_STAGE_WIDTH,
  MIN_WALL_THICKNESS,
  STAGE_HEIGHT,
  STAGE_SIZE_STEP,
  STAGE_WIDTH,
} from "./constants";
import {
  createCourseBoundaries,
  createDefaultCourse,
  createPusher,
  createSpawnPoint,
  createWall,
  PUSHER_DEFAULT_RANGE,
  PUSHER_PERIODS,
} from "./courseObjects";
import { resolveBuilderUi, type BuilderUi } from "./elements";
import { GridOverlay, type GridWorldBounds } from "./gridOverlay";
import { updateBuilderInterface } from "./interfacePresenter";
import { RaceController } from "./raceController";
import {
  SelectedTool,
  type BuilderElements,
  type PusherTool,
  type RoundConfiguration,
} from "./types";
import { clampInteger, clampStepInteger } from "./utils";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;
const isPusherTool = (tool: SelectedTool): tool is PusherTool =>
  tool === SelectedTool.Slider ||
  tool === SelectedTool.Spinner ||
  tool === SelectedTool.Sweeper;
const isCreationTool = (tool: SelectedTool) =>
  tool === SelectedTool.Wall ||
  tool === SelectedTool.SpawnPoint ||
  isPusherTool(tool);
const isRepeatableCreationTool = (tool: SelectedTool) =>
  tool === SelectedTool.Wall;

export class LevelBuilderRuntime {
  readonly stage: Stage;
  private readonly ui: BuilderUi;
  private readonly level: AuthoredLevel;
  private readonly race: RaceController;
  private readonly history: LevelHistory;
  private readonly editorController: LevelEditorController;
  private readonly editorOverlay: EditorOverlay;
  private readonly gridOverlay: GridOverlay;
  private configuration: RoundConfiguration;
  private selectedTool = SelectedTool.Pointer;
  private toolLocked = true;
  private gridSnapEnabled = true;
  private playbackActive = false;

  constructor(selectors: BuilderElements, signal: AbortSignal) {
    this.ui = resolveBuilderUi(selectors);
    this.stage = new Stage({ width: STAGE_WIDTH, height: STAGE_HEIGHT });
    this.stage.centerCameraOnResize = true;
    this.stage.fitStageToWindowOnResizeInsets = this.getStageFitInsets;
    this.stage.fitStageToWindowOnResize = true;
    this.stage.fitStageToWindow(this.getStageFitInsets());

    this.configuration = this.readRoundConfiguration();
    const wallThickness = this.readWallThickness();
    this.level = new AuthoredLevel(
      this.stage,
      this.configuration,
      wallThickness
    );
    for (const object of createDefaultCourse(
      this.stage.width,
      this.stage.height,
      wallThickness
    )) {
      this.level.add(object);
    }

    this.race = new RaceController(this.stage, this.level, this.configuration);
    this.history = new LevelHistory(this.level.document.serialize());
    this.gridOverlay = new GridOverlay(
      this.stage,
      this.ui.majorGridToggleButton,
      this.ui.minorGridToggleButton,
      this.ui.gridOverlay,
      this.getGridWorldBounds
    );
    this.editorController = new LevelEditorController({
      stage: this.stage,
      getObjects: () => this.level.objects,
      getDefaultWallThickness: () => this.level.wallThickness,
      getGridSnapEnabled: () => this.gridSnapEnabled,
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
          if (
            tool === SelectedTool.SpawnPoint ||
            isPusherTool(tool) ||
            !this.toolLocked
          ) {
            this.setActiveTool(SelectedTool.Pointer);
          }
        },
        onToggleToolLock: () => this.toggleToolLock(),
        onUndo: () => this.undo(),
        onRedo: () => this.redo(),
        onReset: () => this.resetRace(),
      },
      signal,
    });
    this.editorOverlay = new EditorOverlay(
      this.ui.editorOverlayCanvas,
      this.stage
    );

    this.bindEventHandlers(signal);
    this.setActiveTool(SelectedTool.Pointer);
    this.gridOverlay.update();
    this.race.reset();
  }

  fixedUpdate(deltaMs: number) {
    this.race.fixedUpdate(deltaMs);
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
    this.updateViewportControls();
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
      toolLocked:
        this.toolLocked && isRepeatableCreationTool(this.selectedTool),
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

  private bindEventHandlers(signal: AbortSignal) {
    const toolBindings: Array<[HTMLButtonElement, SelectedTool]> = [
      [this.ui.panButton, SelectedTool.Pan],
      [this.ui.pointerButton, SelectedTool.Pointer],
      [this.ui.wallButton, SelectedTool.Wall],
      [this.ui.spawnPointButton, SelectedTool.SpawnPoint],
      [this.ui.sliderButton, SelectedTool.Slider],
      [this.ui.spinnerButton, SelectedTool.Spinner],
      [this.ui.sweeperButton, SelectedTool.Sweeper],
    ];
    for (const [button, tool] of toolBindings) {
      button.addEventListener("click", () => this.setActiveTool(tool), {
        signal,
      });
    }
    this.ui.pusherMenuToggleButton.addEventListener(
      "click",
      () => this.setPusherLibraryOpen(this.ui.pusherLibrary.hidden),
      { signal }
    );
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (
          !this.ui.pusherLibrary.hidden &&
          !this.ui.pusherLibrary.contains(event.target as Node) &&
          !this.ui.pusherMenuToggleButton.contains(event.target as Node)
        ) {
          this.setPusherLibraryOpen(false);
        }
      },
      { signal }
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && !this.ui.pusherLibrary.hidden) {
          this.setPusherLibraryOpen(false);
          this.ui.pusherMenuToggleButton.focus();
        }
      },
      { signal }
    );
    this.ui.toolLockButton.addEventListener(
      "click",
      () => this.toggleToolLock(),
      { signal }
    );

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
    this.ui.gridSnapToggleButton.addEventListener(
      "click",
      this.toggleGridSnap,
      { signal }
    );
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
    this.ui.wallThicknessInput.addEventListener(
      "change",
      this.handleWallThicknessChange,
      { signal }
    );
    this.ui.motionTypeSelect.addEventListener(
      "change",
      this.handleMotionTypeChange,
      { signal }
    );
    this.ui.motionRangeInput.addEventListener(
      "input",
      this.handleMotionRangeInput,
      { signal }
    );
    this.ui.motionRangeInput.addEventListener(
      "change",
      this.handleMotionRangeCommit,
      { signal }
    );
    this.ui.motionReverseButton.addEventListener(
      "click",
      this.reverseSelectedMotion,
      { signal }
    );
    for (const button of this.ui.motionSpeedButtons) {
      button.addEventListener("click", this.setSelectedMotionSpeed, { signal });
    }
    this.ui.playButton.addEventListener("click", this.toggleRace, { signal });
    this.ui.resetButton.addEventListener("click", this.resetRace, { signal });
    this.ui.undoButton.addEventListener("click", () => this.undo(), { signal });
    this.ui.redoButton.addEventListener("click", () => this.redo(), { signal });
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
      () => this.setZoomAtCanvasCenter(1),
      { signal }
    );
  }

  private setActiveTool(tool: SelectedTool) {
    if (this.playbackActive && isCreationTool(tool)) {
      return;
    }
    this.selectedTool = tool;
    const buttonByTool = new Map<SelectedTool, HTMLButtonElement>([
      [SelectedTool.Pan, this.ui.panButton],
      [SelectedTool.Pointer, this.ui.pointerButton],
      [SelectedTool.Wall, this.ui.wallButton],
      [SelectedTool.SpawnPoint, this.ui.spawnPointButton],
      [SelectedTool.Slider, this.ui.sliderButton],
      [SelectedTool.Spinner, this.ui.spinnerButton],
      [SelectedTool.Sweeper, this.ui.sweeperButton],
    ]);
    for (const button of buttonByTool.values()) {
      button.dataset.active = `${button === buttonByTool.get(tool)}`;
    }
    this.ui.pusherMenuToggleButton.dataset.active = `${isPusherTool(tool)}`;
    if (isPusherTool(tool)) {
      this.setPusherLibraryOpen(false);
    }
    this.editorController.setActiveTool(tool);
    this.stage.canvas.dataset.pointer =
      tool === SelectedTool.Pan
        ? "pan"
        : tool === SelectedTool.Pointer
          ? "select"
          : "shape";
  }

  private toggleToolLock() {
    if (this.playbackActive || !isRepeatableCreationTool(this.selectedTool)) {
      return;
    }
    this.toolLocked = !this.toolLocked;
  }

  private readonly toggleGridSnap = () => {
    this.gridSnapEnabled = !this.gridSnapEnabled;
    this.ui.gridSnapToggleButton.dataset.active = `${this.gridSnapEnabled}`;
    this.ui.gridSnapToggleButton.ariaChecked = `${this.gridSnapEnabled}`;
  };

  private setPusherLibraryOpen(open: boolean) {
    this.ui.pusherLibrary.hidden = !open;
    this.ui.pusherMenuToggleButton.ariaExpanded = `${open}`;
  }

  private getSelectedEditableWall() {
    const object = this.editorController.selectedObject;
    return object?.prefab === "wall" && !object.locked ? object : null;
  }

  private updateSelectedMotion(
    update: (object: Extract<LevelObjectData, { prefab: "wall" }>) => void,
    commit = true
  ) {
    const object = this.getSelectedEditableWall();
    if (!object || this.playbackActive) {
      return;
    }
    update(object);
    this.level.refresh(object);
    if (commit) {
      this.commitLevelChange();
    }
  }

  private readonly handleMotionTypeChange = () => {
    const value = this.ui.motionTypeSelect.value;
    this.updateSelectedMotion((object) => {
      if (value === "none") {
        delete object.motion;
        return;
      }
      const current = object.motion;
      const shared = {
        periodMs: current?.periodMs ?? PUSHER_PERIODS.medium,
        phase: current?.phase ?? 0,
        direction: current?.direction ?? (1 as const),
      };
      let motion: LevelObjectMotion;
      if (value === "slide") {
        const shape = getLevelObjectShape(object, this.level.wallThickness);
        const rotation = shape.kind === "rectangle" ? shape.rotation : 0;
        motion = {
          type: "oscillate",
          vector:
            current?.type === "oscillate"
              ? [...current.vector]
              : [
                  -Math.sin(rotation) * PUSHER_DEFAULT_RANGE,
                  Math.cos(rotation) * PUSHER_DEFAULT_RANGE,
                ],
          ...shared,
        };
      } else {
        motion = {
          type: "rotate",
          pivot: value === "sweep" ? "start" : "center",
          ...shared,
        };
      }
      object.motion = motion;
    });
  };

  private readonly handleMotionRangeInput = () => {
    const range = clampInteger(this.ui.motionRangeInput.value, 15, 240);
    this.ui.motionRangeOutput.value = `${range}`;
    this.updateSelectedMotion((object) => {
      if (object.motion?.type !== "oscillate") {
        return;
      }
      const magnitude = Math.hypot(...object.motion.vector);
      const direction: Vec2 =
        magnitude > Number.EPSILON
          ? [
              object.motion.vector[0] / magnitude,
              object.motion.vector[1] / magnitude,
            ]
          : [1, 0];
      object.motion.vector = [direction[0] * range, direction[1] * range];
    }, false);
  };

  private readonly handleMotionRangeCommit = () => {
    this.handleMotionRangeInput();
    this.commitLevelChange();
  };

  private readonly reverseSelectedMotion = () => {
    this.updateSelectedMotion((object) => {
      if (object.motion) {
        object.motion.direction = object.motion.direction === 1 ? -1 : 1;
      }
    });
  };

  private readonly setSelectedMotionSpeed = (event: Event) => {
    const speed = (event.currentTarget as HTMLButtonElement).dataset.speed as
      | keyof typeof PUSHER_PERIODS
      | undefined;
    if (!speed) {
      return;
    }
    this.updateSelectedMotion((object) => {
      if (object.motion) {
        object.motion.periodMs = PUSHER_PERIODS[speed];
      }
    });
  };

  private refreshAuthoredObjects(objects: readonly LevelObjectData[]) {
    for (const object of objects) {
      this.level.refresh(object);
    }
  }

  private commitLevelChange() {
    this.race.reset();
    this.history.record(this.level.document.serialize());
  }

  private undo() {
    if (this.playbackActive) {
      return;
    }
    const snapshot = this.history.undo();
    if (snapshot) {
      this.restoreLevel(snapshot);
    }
  }

  private redo() {
    if (this.playbackActive) {
      return;
    }
    const snapshot = this.history.redo();
    if (snapshot) {
      this.restoreLevel(snapshot);
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
      this.stage.fitStageToWindow(this.getStageFitInsets());
    }
    this.race.reset();
  }

  private adjustZoom(delta: number) {
    this.setZoomAtCanvasCenter(
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.stage.zoom + delta))
    );
  }

  private setZoomAtCanvasCenter(zoom: number) {
    this.stage.zoomAtScreenPoint(
      this.stage.canvas.clientWidth / 2,
      this.stage.canvas.clientHeight / 2,
      zoom
    );
  }

  private updateViewportControls() {
    this.ui.zoomLevelOutput.value = `${Math.round(this.stage.zoom * 100)}%`;
    this.ui.zoomOutButton.disabled = this.stage.zoom <= MIN_ZOOM;
    this.ui.zoomInButton.disabled = this.stage.zoom >= MAX_ZOOM;
  }

  private readonly getStageFitInsets = (): StageFitInsets => {
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
    this.editorController.setReadOnly(playbackActive);
    if (playbackActive) {
      this.setPusherLibraryOpen(false);
      this.editorController.clearSelection();
      this.setActiveTool(SelectedTool.Pan);
    } else {
      this.setActiveTool(SelectedTool.Pointer);
    }
  }

  private readCourseSize(): Vec2 {
    return [
      clampStepInteger(
        this.ui.courseWidthInput.value,
        MIN_STAGE_WIDTH,
        MAX_STAGE_WIDTH,
        STAGE_SIZE_STEP
      ),
      clampStepInteger(
        this.ui.courseHeightInput.value,
        MIN_STAGE_HEIGHT,
        MAX_STAGE_HEIGHT,
        STAGE_SIZE_STEP
      ),
    ];
  }

  private readWallThickness() {
    return clampInteger(
      this.ui.wallThicknessInput.value || `${COURSE_STROKE_WIDTH}`,
      MIN_WALL_THICKNESS,
      MAX_WALL_THICKNESS
    );
  }

  private readRoundConfiguration(): RoundConfiguration {
    return {
      teamCount: clampInteger(this.ui.teamCountInput.value, 2, MAX_TEAMS),
      marblesPerTeam: clampInteger(this.ui.marblesPerTeamInput.value, 1, 100),
      releaseIntervalMs: clampInteger(
        this.ui.releaseIntervalInput.value,
        10,
        250
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
    this.level.resize(
      [width, height],
      createCourseBoundaries(width, height, this.level.wallThickness)
    );
    this.stage.fitStageToWindow(this.getStageFitInsets());
    this.commitLevelChange();
  };

  private readonly handleWallThicknessChange = () => {
    const wallThickness = this.readWallThickness();
    this.ui.wallThicknessInput.value = `${wallThickness}`;
    if (wallThickness === this.level.wallThickness) {
      return;
    }
    this.level.setWallThickness(wallThickness);
    this.level.resize(
      [this.stage.width, this.stage.height],
      createCourseBoundaries(this.stage.width, this.stage.height, wallThickness)
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
