import type { Vec2 } from "../../engine/core/transform";
import type { LevelObjectData } from "../../game/level/document";
import {
  applyLevelObjectShape,
  getLevelObjectShape,
  getWallEndpoints,
  moveShape,
  setWallEndpoints,
} from "../../game/level/geometry";
import { SelectedTool } from "../tools";
import type { EditorGesture } from "./gestures";
import type { LevelEditorSelection } from "./selection";

export type SelectionActionHost = {
  readonly readOnly: boolean;
  readonly selection: LevelEditorSelection;
  readonly activeTool: SelectedTool;
  readonly callbacks: {
    onDelete(objects: readonly LevelObjectData[]): void;
    onObjectsChange(objects: readonly LevelObjectData[]): void;
    onObjectsCommit(objects: readonly LevelObjectData[]): void;
    onToolRequest(tool: SelectedTool): void;
  };
  readonly selectedObjects: readonly LevelObjectData[];
  readonly getObjects: () => readonly LevelObjectData[];
  readonly getDefaultWallThickness: () => number;
  gesture: EditorGesture | null;
  wallAnchor: Vec2 | null;
  cancelGesture(): void;
  clearWallAnchor(): void;
  clearSelection(): void;
  updateCursor(): void;
};

export const selectAllObjects = (host: SelectionActionHost) => {
  if (host.readOnly) {
    return false;
  }
  host.selection.replaceAll(
    host
      .getObjects()
      .filter((object) => !object.locked)
      .map((object) => object.id)
  );
  return true;
};

export const handleEscapeKey = (host: SelectionActionHost) => {
  if (host.gesture) {
    host.cancelGesture();
  } else if (host.wallAnchor) {
    host.clearWallAnchor();
  } else if (host.activeTool !== SelectedTool.Pointer) {
    host.callbacks.onToolRequest(SelectedTool.Pointer);
  } else if (host.selection.size > 0) {
    host.clearSelection();
  }
  return true;
};

export const finishWallDraft = (host: SelectionActionHost) => {
  if (!host.wallAnchor) {
    return false;
  }
  host.clearWallAnchor();
  host.updateCursor();
  return true;
};

export const deleteSelectedObjects = (host: SelectionActionHost) => {
  const selected = host.selectedObjects;
  if (selected.length === 0 || host.readOnly) {
    return false;
  }
  host.cancelGesture();
  host.callbacks.onDelete(selected);
  host.clearSelection();
  return true;
};

export const nudgeSelectedObjects = (
  host: SelectionActionHost,
  direction: Vec2,
  distance: number
) => {
  const selected = host.selectedObjects;
  if (selected.length === 0 || host.readOnly) {
    return false;
  }
  for (const object of selected) {
    if (object.prefab === "wall") {
      const { start, end } = getWallEndpoints(object);
      setWallEndpoints(
        object,
        [
          start[0] + direction[0] * distance,
          start[1] + direction[1] * distance,
        ],
        [end[0] + direction[0] * distance, end[1] + direction[1] * distance]
      );
    } else {
      const shape = getLevelObjectShape(
        object,
        host.getDefaultWallThickness()
      );
      applyLevelObjectShape(
        object,
        moveShape(shape, [
          shape.position[0] + direction[0] * distance,
          shape.position[1] + direction[1] * distance,
        ])
      );
    }
  }
  host.callbacks.onObjectsChange(selected);
  host.callbacks.onObjectsCommit(selected);
  return true;
};
