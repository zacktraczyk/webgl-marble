import type { Vec2 } from "../../engine/core/transform";
import type { LevelObjectData } from "../../game/level/document";
import { getWallEndpoints } from "../../game/level/geometry";
import {
  pickLevelObject,
  pickTolerance,
  resizeHandleCursor,
} from "../geometry";
import { SelectedTool } from "../tools";
import { HANDLE_HIT_RADIUS } from "./constants";
import type { EditorGesture, WallEndpointFeedback } from "./gestures";
import {
  endpointAt,
  findWallEndpointTarget,
  motionRangeHandleAt,
  resizeHandleAt,
  rotationHandleAt,
  type HandleTestDeps,
  type WallEndpointTarget,
} from "./handles";
import type { LegEditorKeyboard } from "./keyboard";
import type { LegEditorSelection } from "./selection";

export type IdleCursorContext = {
  gesture: EditorGesture | null;
  keyboard: Pick<LegEditorKeyboard, "spaceHeld" | "selectionModifierHeld">;
  activeTool: SelectedTool;
  creationToolActive: boolean;
  readOnly: boolean;
  selection: LegEditorSelection;
  handleDeps: HandleTestDeps;
  selectedObject: LevelObjectData | null;
  getObjects: () => readonly LevelObjectData[];
  worldPoint: (screenPoint: Vec2) => Vec2;
  cameraZoom: number;
  getDefaultWallThickness: () => number;
  setCursor: (cursor: string) => void;
  setEndpointFeedback: (feedback: WallEndpointFeedback | null) => void;
  showEndpointFeedback: (
    target: WallEndpointTarget | null,
    kind: WallEndpointFeedback["kind"]
  ) => void;
};

export function updateIdleState(
  ctx: IdleCursorContext,
  screenPoint: Vec2,
  {
    temporarySelection = ctx.keyboard.selectionModifierHeld &&
      ctx.creationToolActive,
  }: { temporarySelection?: boolean } = {}
) {
  if (ctx.gesture) {
    return;
  }
  if (ctx.keyboard.spaceHeld || ctx.activeTool === SelectedTool.Pan) {
    ctx.selection.setHovered(null);
    ctx.setCursor("grab");
    return;
  }
  if (ctx.creationToolActive && !temporarySelection) {
    ctx.selection.setHovered(null);
    ctx.setCursor(ctx.readOnly ? "not-allowed" : "crosshair");
    return;
  }

  const handleDeps = ctx.handleDeps;
  const directEndpointTarget = temporarySelection
    ? findWallEndpointTarget(handleDeps, screenPoint, HANDLE_HIT_RADIUS, {
        selectableOnly: true,
      })
    : null;
  if (directEndpointTarget) {
    ctx.selection.setHovered(directEndpointTarget.objectId);
    ctx.showEndpointFeedback(directEndpointTarget, "edit");
    ctx.setCursor(ctx.readOnly ? "default" : "crosshair");
    return;
  }

  ctx.setEndpointFeedback(null);
  const selectedObject = ctx.selectedObject;
  if (
    selectedObject &&
    motionRangeHandleAt(handleDeps, selectedObject, screenPoint)
  ) {
    ctx.selection.setHovered(selectedObject.id);
    ctx.setCursor(ctx.readOnly ? "default" : "crosshair");
    return;
  }
  const selectedEndpoint = selectedObject
    ? endpointAt(handleDeps, selectedObject, screenPoint)
    : null;
  if (selectedObject?.prefab === "wall" && selectedEndpoint) {
    const { start, end } = getWallEndpoints(selectedObject);
    ctx.selection.setHovered(selectedObject.id);
    ctx.showEndpointFeedback(
      {
        object: selectedObject,
        objectId: selectedObject.id,
        endpoint: selectedEndpoint,
        position: selectedEndpoint === "start" ? start : end,
      },
      "edit"
    );
    ctx.setCursor(ctx.readOnly ? "default" : "crosshair");
    return;
  }
  if (
    selectedObject &&
    rotationHandleAt(handleDeps, selectedObject, screenPoint)
  ) {
    ctx.selection.setHovered(selectedObject.id);
    ctx.setCursor(ctx.readOnly ? "default" : "grab");
    return;
  }
  const handle = selectedObject
    ? resizeHandleAt(handleDeps, selectedObject, screenPoint)
    : null;
  if (handle) {
    ctx.selection.setHovered(selectedObject?.id ?? null);
    ctx.setCursor(ctx.readOnly ? "default" : resizeHandleCursor(handle));
    return;
  }
  const hoveredObject = pickLevelObject(
    ctx.getObjects(),
    ctx.worldPoint(screenPoint),
    pickTolerance(ctx.cameraZoom),
    ctx.getDefaultWallThickness()
  );
  ctx.selection.setHovered(hoveredObject?.id ?? null);
  ctx.setCursor(hoveredObject && !ctx.readOnly ? "grab" : "default");
}

export function updateCursor(ctx: IdleCursorContext) {
  if (ctx.gesture?.kind === "pan") {
    ctx.setCursor("grabbing");
  } else if (ctx.keyboard.spaceHeld || ctx.activeTool === SelectedTool.Pan) {
    ctx.setCursor("grab");
  } else if (ctx.keyboard.selectionModifierHeld && ctx.creationToolActive) {
    ctx.setCursor("default");
  } else if (ctx.creationToolActive) {
    ctx.setCursor(ctx.readOnly ? "not-allowed" : "crosshair");
  } else {
    ctx.setCursor("default");
  }
}
