import type { Vec2 } from "../../engine/core/transform";
import type { LevelObjectData } from "../../game/level/document";
import type { GridLayout } from "../../game/level/grid";
import type { PusherTool, SelectedTool } from "../tools";
import type { DragDepsBase } from "./gestureDrag";
import type { WallEndpointFeedback } from "./gestures";
import type { HandleTestDeps, WallEndpointTarget } from "./handles";
import type { LegEditorKeyboard } from "./keyboard";
import type { SnapDeps } from "./snap";

export type EditorCallbacks = {
  onObjectsChange(objects: readonly LevelObjectData[]): void;
  onObjectsCommit(objects: readonly LevelObjectData[]): void;
  onDelete(objects: readonly LevelObjectData[]): void;
  onInsert(objects: readonly LevelObjectData[]): LevelObjectData[];
  onDiscard(objects: readonly LevelObjectData[]): void;
  onCreateWall(start: Vec2, end: Vec2): LevelObjectData;
  onPlaceObject(tool: PusherTool, position: Vec2): LevelObjectData;
  onToolRequest(tool: SelectedTool): void;
  onToolComplete(tool: SelectedTool): void;
  onUndo(): void;
  onRedo(): void;
  onReset(): void;
  onFocus(objects: readonly LevelObjectData[]): void;
};

export type EditorCameraControls = {
  panByScreen(deltaX: number, deltaY: number): void;
  handleWheel(screenPoint: Vec2, event: WheelEvent): void;
};

export type EditorEnv = {
  readonly callbacks: EditorCallbacks;
  readonly getObjects: () => readonly LevelObjectData[];
  readonly getDefaultWallThickness: () => number;
  readonly getGridSnapEnabled: () => boolean;
  readonly getGridLayout: () => GridLayout;
  readonly cameraControls: EditorCameraControls;
  readonly keyboard: LegEditorKeyboard;
  readonly screenPoint: (event: PointerEvent | WheelEvent) => Vec2;
  readonly worldPoint: (screenPoint: Vec2) => Vec2;
  readonly screenDistance: (first: Vec2, second: Vec2) => number;
  readonly setCursor: (cursor: string) => void;
  readonly capturePointer: (pointerId: number) => void;
  readonly releasePointer: (pointerId: number) => void;
  readonly cameraZoom: () => number;
  readonly handleDeps: () => HandleTestDeps;
  readonly snapDeps: () => SnapDeps;
  readonly dragDeps: () => DragDepsBase;
  readonly cancelGesture: () => void;
  readonly updateIdleState: (
    screenPoint: Vec2,
    options?: { temporarySelection?: boolean }
  ) => void;
  readonly updateCursor: () => void;
  readonly showEndpointFeedback: (
    target: WallEndpointTarget | null,
    kind: WallEndpointFeedback["kind"]
  ) => void;
  readonly isTemporarySelection: (modifier: {
    metaKey: boolean;
    ctrlKey: boolean;
  }) => boolean;
  readonly clearWallAnchor: () => void;
};
