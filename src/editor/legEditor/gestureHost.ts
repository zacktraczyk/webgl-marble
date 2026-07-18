import type { Vec2 } from "../../engine/core/transform";
import type { GridLayout } from "../../game/level/grid";
import type { LevelObjectData } from "../../game/level/document";
import type { SelectedTool } from "../tools";
import type {
  EditorGesture,
  WallEndpointFeedback,
} from "./gestures";
import type {
  HandleTestDeps,
  WallEndpointTarget,
} from "./handles";
import type { LegEditorKeyboard } from "./keyboard";
import type { PointerGestureHost } from "./pointerGestures";
import type { LegEditorSelection } from "./selection";
import type { SnapDeps } from "./snap";

/** Minimal surface `createGestureHost` needs from `LegEditorController`. */
export type GestureHostController = {
  gesture: EditorGesture | null;
  wallAnchor: Vec2 | null;
  wallPreviewEnd: Vec2 | null;
  endpointFeedback: WallEndpointFeedback | null;
  placementPreviewPosition: Vec2 | null;
  lastPointerScreen: Vec2 | null;
  readonly activeTool: SelectedTool;
  readonly readOnly: boolean;
  readonly handleDeps: HandleTestDeps;
  readonly snapDeps: SnapDeps;
  readonly dragDeps: {
    screenDistance: (first: Vec2, second: Vec2) => number;
    getDefaultWallThickness: () => number;
    getGridSnapEnabled: () => boolean;
    getGridLayout: () => GridLayout;
    getObjects: () => readonly LevelObjectData[];
    findObject: (id: string) => LevelObjectData | null | undefined;
    onObjectsChange: (objects: readonly LevelObjectData[]) => void;
  };
  readonly selection: LegEditorSelection;
  readonly callbacks: PointerGestureHost["callbacks"];
  readonly cameraControls: PointerGestureHost["cameraControls"];
  readonly keyboard: LegEditorKeyboard;
  readonly creationToolActive: boolean;
  readonly selectedObject: LevelObjectData | null;
  readonly selectedObjects: readonly LevelObjectData[];
  readonly cameraZoom: number;
  screenPoint(event: PointerEvent): Vec2;
  worldPoint(screenPoint: Vec2): Vec2;
  screenDistance(first: Vec2, second: Vec2): number;
  capturePointer(pointerId: number): void;
  releasePointer(pointerId: number): void;
  cancelGesture(): void;
  updateIdleState(
    screenPoint: Vec2,
    options?: { temporarySelection?: boolean }
  ): void;
  showEndpointFeedback(
    target: WallEndpointTarget | null,
    kind: WallEndpointFeedback["kind"]
  ): void;
  isTemporarySelection(modifier: {
    metaKey: boolean;
    ctrlKey: boolean;
  }): boolean;
  clearWallAnchor(): void;
  getObjects(): readonly LevelObjectData[];
  getDefaultWallThickness(): number;
  setCursor(cursor: string): void;
};

/** Bind live getters/setters to the controller without rebuilding per event. */
export function createGestureHost(
  controller: GestureHostController
): PointerGestureHost {
  return {
    get gesture() {
      return controller.gesture;
    },
    set gesture(value) {
      controller.gesture = value;
    },
    get wallAnchor() {
      return controller.wallAnchor;
    },
    set wallAnchor(value) {
      controller.wallAnchor = value;
    },
    get wallPreviewEnd() {
      return controller.wallPreviewEnd;
    },
    set wallPreviewEnd(value) {
      controller.wallPreviewEnd = value;
    },
    get endpointFeedback() {
      return controller.endpointFeedback;
    },
    set endpointFeedback(value) {
      controller.endpointFeedback = value;
    },
    get placementPreviewPosition() {
      return controller.placementPreviewPosition;
    },
    set placementPreviewPosition(value) {
      controller.placementPreviewPosition = value;
    },
    get lastPointerScreen() {
      return controller.lastPointerScreen;
    },
    set lastPointerScreen(value) {
      controller.lastPointerScreen = value;
    },
    get activeTool() {
      return controller.activeTool;
    },
    get readOnly() {
      return controller.readOnly;
    },
    get handleDeps() {
      return controller.handleDeps;
    },
    get snapDeps() {
      return controller.snapDeps;
    },
    get dragDeps() {
      return controller.dragDeps;
    },
    selection: controller.selection,
    callbacks: controller.callbacks,
    cameraControls: controller.cameraControls,
    keyboard: controller.keyboard,
    get creationToolActive() {
      return controller.creationToolActive;
    },
    get selectedObject() {
      return controller.selectedObject;
    },
    get selectedObjects() {
      return controller.selectedObjects;
    },
    get cameraZoom() {
      return controller.cameraZoom;
    },
    screenPoint: (event) => controller.screenPoint(event),
    worldPoint: (screenPoint) => controller.worldPoint(screenPoint),
    screenDistance: (first, second) =>
      controller.screenDistance(first, second),
    capturePointer: (pointerId) => controller.capturePointer(pointerId),
    releasePointer: (pointerId) => controller.releasePointer(pointerId),
    cancelGesture: () => controller.cancelGesture(),
    updateIdleState: (screenPoint, options) =>
      controller.updateIdleState(screenPoint, options),
    showEndpointFeedback: (target, kind) =>
      controller.showEndpointFeedback(target, kind),
    isTemporarySelection: (modifier) =>
      controller.isTemporarySelection(modifier),
    clearWallAnchor: () => controller.clearWallAnchor(),
    getObjects: () => controller.getObjects(),
    getDefaultWallThickness: () => controller.getDefaultWallThickness(),
    setCursor: (cursor) => controller.setCursor(cursor),
  };
}
