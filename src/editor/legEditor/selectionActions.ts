import type { Vec2 } from "../../engine/core/transform";
import type { LevelObjectData } from "../../game/level/document";
import {
  applyLevelObjectShape,
  getLevelObjectShape,
  getWallEndpoints,
  setWallEndpoints,
} from "../../game/level/geometry";
import { moveShape } from "../geometry";
import { SelectedTool } from "../tools";
import type { EditorGesture } from "./gestures";
import type { LegEditorSelection } from "./selection";
import type { GridLayout } from "../../game/level/grid";
import {
  alignLevelObjects,
  distributeLevelObjects,
  getSelectionBounds,
  mirrorLevelObjects,
  moveLevelObjectBy,
  selectionCenter,
  type SelectionAlignment,
  type SelectionDistribution,
  type SelectionMirror,
} from "./selectionTransforms";

const CLIPBOARD_KEY = "marble:leg-editor-clipboard";
let memoryClipboard: LevelObjectData[] = [];

const copyableObjects = (objects: readonly LevelObjectData[]) =>
  objects.filter((object) => !object.locked && object.prefab !== "spawn-point");

const writeClipboard = (objects: readonly LevelObjectData[]) => {
  memoryClipboard = structuredClone(copyableObjects(objects));
  try {
    window.sessionStorage.setItem(
      CLIPBOARD_KEY,
      JSON.stringify(memoryClipboard)
    );
  } catch {
    // The in-memory clipboard still supports the current editor session.
  }
};

const clipboardCopies = (
  host: SelectionActionHost,
  objects: readonly LevelObjectData[]
) =>
  structuredClone(copyableObjects(objects)).map((object) => {
    if (object.prefab === "wall" && object.properties.thickness === undefined) {
      object.properties.thickness = host.getDefaultWallThickness();
    }
    return object;
  });

const readClipboard = () => {
  if (memoryClipboard.length > 0) {
    return structuredClone(memoryClipboard);
  }
  try {
    const value = window.sessionStorage.getItem(CLIPBOARD_KEY);
    const parsed = value ? (JSON.parse(value) as LevelObjectData[]) : [];
    memoryClipboard = copyableObjects(parsed);
  } catch {
    memoryClipboard = [];
  }
  return structuredClone(memoryClipboard);
};

export type SelectionActionHost = {
  readonly readOnly: boolean;
  readonly selection: LegEditorSelection;
  readonly activeTool: SelectedTool;
  readonly callbacks: {
    onDelete(objects: readonly LevelObjectData[]): void;
    onInsert(objects: readonly LevelObjectData[]): LevelObjectData[];
    onDiscard(objects: readonly LevelObjectData[]): void;
    onObjectsChange(objects: readonly LevelObjectData[]): void;
    onObjectsCommit(objects: readonly LevelObjectData[]): void;
    onFocus(objects: readonly LevelObjectData[]): void;
    onToolRequest(tool: SelectedTool): void;
  };
  readonly selectedObjects: readonly LevelObjectData[];
  readonly getObjects: () => readonly LevelObjectData[];
  readonly getDefaultWallThickness: () => number;
  readonly getGridLayout: () => GridLayout;
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
  const selected = copyableObjects(host.selectedObjects);
  if (selected.length === 0 || host.readOnly) {
    return false;
  }
  host.cancelGesture();
  host.callbacks.onDelete(selected);
  host.clearSelection();
  return true;
};

export const hasClipboardObjects = () => readClipboard().length > 0;

export const copySelectedObjects = (host: SelectionActionHost) => {
  const selected = copyableObjects(host.selectedObjects);
  if (selected.length === 0) {
    return false;
  }
  writeClipboard(clipboardCopies(host, selected));
  return true;
};

export const cutSelectedObjects = (host: SelectionActionHost) => {
  const selected = copyableObjects(host.selectedObjects);
  if (selected.length === 0 || host.readOnly) {
    return false;
  }
  writeClipboard(clipboardCopies(host, selected));
  host.cancelGesture();
  host.callbacks.onDelete(selected);
  host.selection.replaceAll(
    host.selectedObjects
      .filter((object) => !selected.includes(object))
      .map((object) => object.id)
  );
  return true;
};

const insertCopies = (
  host: SelectionActionHost,
  source: readonly LevelObjectData[],
  delta: Vec2
) => {
  const copies = structuredClone(copyableObjects(source));
  if (copies.length === 0 || host.readOnly) {
    return false;
  }
  for (const object of copies) {
    moveLevelObjectBy(object, delta, host.getDefaultWallThickness());
  }
  const inserted = host.callbacks.onInsert(copies);
  host.selection.replaceAll(inserted.map((object) => object.id));
  host.callbacks.onObjectsCommit(inserted);
  return inserted.length > 0;
};

export const duplicateSelectedObjects = (
  host: SelectionActionHost,
  delta: Vec2 = [...host.getGridLayout().step]
) => insertCopies(host, host.selectedObjects, delta);

export const pasteClipboardObjects = (
  host: SelectionActionHost,
  options: { inPlace?: boolean; at?: Vec2 } = {}
) => {
  const clipboard = readClipboard();
  if (clipboard.length === 0 || host.readOnly) {
    return false;
  }
  let delta: Vec2;
  if (options.at) {
    const bounds = getSelectionBounds(
      clipboard,
      host.getDefaultWallThickness()
    );
    const center = bounds ? selectionCenter(bounds) : ([0, 0] as Vec2);
    delta = [options.at[0] - center[0], options.at[1] - center[1]];
  } else if (options.inPlace) {
    delta = [0, 0];
  } else {
    delta = [...host.getGridLayout().step];
  }
  return insertCopies(host, clipboard, delta);
};

export const alignSelectedObjects = (
  host: SelectionActionHost,
  alignment: SelectionAlignment
) => {
  const selected = host.selectedObjects;
  if (
    host.readOnly ||
    !alignLevelObjects(selected, host.getDefaultWallThickness(), alignment)
  ) {
    return false;
  }
  host.callbacks.onObjectsChange(selected);
  host.callbacks.onObjectsCommit(selected);
  return true;
};

export const distributeSelectedObjects = (
  host: SelectionActionHost,
  distribution: SelectionDistribution
) => {
  const selected = host.selectedObjects;
  if (
    host.readOnly ||
    !distributeLevelObjects(
      selected,
      host.getDefaultWallThickness(),
      distribution
    )
  ) {
    return false;
  }
  host.callbacks.onObjectsChange(selected);
  host.callbacks.onObjectsCommit(selected);
  return true;
};

export const mirrorCopySelectedObjects = (
  host: SelectionActionHost,
  mirror: SelectionMirror
) => {
  const copies = structuredClone(copyableObjects(host.selectedObjects));
  if (
    host.readOnly ||
    !mirrorLevelObjects(copies, host.getDefaultWallThickness(), mirror, [0, 0])
  ) {
    return false;
  }
  const inserted = host.callbacks.onInsert(copies);
  host.selection.replaceAll(inserted.map((object) => object.id));
  host.callbacks.onObjectsCommit(inserted);
  return inserted.length > 0;
};

export const mirrorSelectedObjects = (
  host: SelectionActionHost,
  mirror: SelectionMirror
) => {
  const selected = host.selectedObjects;
  if (
    host.readOnly ||
    !mirrorLevelObjects(selected, host.getDefaultWallThickness(), mirror)
  ) {
    return false;
  }
  host.callbacks.onObjectsChange(selected);
  host.callbacks.onObjectsCommit(selected);
  return true;
};

export const focusSelectedObjects = (host: SelectionActionHost) => {
  const selected = host.selectedObjects;
  if (selected.length === 0) {
    return false;
  }
  host.callbacks.onFocus(selected);
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
      const shape = getLevelObjectShape(object, host.getDefaultWallThickness());
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
