import type Stage from "../engine/stage";
import type { LevelObjectData } from "./levelDocument";
import {
  getLevelObjectBounds,
  getLevelObjectShape,
  getRectangleCorners,
  getRotationHandle,
  getResizeAnchors,
  getWallEndpoints,
  isLevelObjectRotatable,
  isLevelObjectResizable,
  type LevelObjectShape,
  type RectangleLevelShape,
} from "./levelGeometry";
import type { SelectionMarquee, WallDraft } from "./levelEditorController";

export type EditorOverlayState = {
  active: boolean;
  readOnly: boolean;
  defaultWallThickness: number;
  hoveredObject: LevelObjectData | null;
  selectedObjects: readonly LevelObjectData[];
  wallDraft: WallDraft | null;
  selectionMarquee: SelectionMarquee | null;
};

const wallDraftShape = ({
  start,
  end,
  thickness,
}: WallDraft): RectangleLevelShape => ({
  kind: "rectangle",
  position: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
  rotation: Math.atan2(end[1] - start[1], end[0] - start[0]),
  width: Math.hypot(end[0] - start[0], end[1] - start[1]),
  height: thickness,
});

export class EditorOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly stage: Stage;

  constructor(canvas: HTMLCanvasElement, stage: Stage) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to initialize the level editor overlay");
    }
    this.canvas = canvas;
    this.context = context;
    this.stage = stage;
  }

  render({
    active,
    readOnly,
    defaultWallThickness,
    hoveredObject,
    selectedObjects,
    wallDraft,
    selectionMarquee,
  }: EditorOverlayState) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);

    if (
      this.canvas.width !== pixelWidth ||
      this.canvas.height !== pixelHeight
    ) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.context.clearRect(0, 0, width, height);
    if (!active) {
      return;
    }

    const selectedIds = new Set(selectedObjects.map((object) => object.id));
    if (hoveredObject && !selectedIds.has(hoveredObject.id)) {
      this.strokeObject(
        hoveredObject,
        defaultWallThickness,
        "rgb(244 244 245 / 88%)",
        1.5,
        [5, 4]
      );
    }

    for (const object of selectedObjects) {
      this.strokeObject(object, defaultWallThickness, "rgb(34 211 238)", 2, []);
    }

    if (selectedObjects.length > 1) {
      this.drawSelectionBounds(selectedObjects, defaultWallThickness);
    } else if (selectedObjects.length === 1 && !readOnly) {
      const selectedObject = selectedObjects[0];
      if (selectedObject.prefab === "wall") {
        this.drawWallEndpoints(selectedObject);
      } else {
        const shape = getLevelObjectShape(selectedObject, defaultWallThickness);
        if (isLevelObjectResizable(selectedObject)) {
          this.drawResizeAnchors(shape);
        }
        if (isLevelObjectRotatable(selectedObject)) {
          this.drawRotationHandle(shape);
        }
      }
    }

    if (wallDraft) {
      this.drawWallDraft(wallDraft);
    }
    if (selectionMarquee) {
      this.drawMarquee(selectionMarquee);
    }
  }

  private strokeObject(
    object: LevelObjectData,
    defaultWallThickness: number,
    color: string,
    lineWidth: number,
    dash: number[]
  ) {
    this.strokeShape(
      getLevelObjectShape(object, defaultWallThickness),
      color,
      lineWidth,
      dash
    );
  }

  private strokeShape(
    shape: LevelObjectShape,
    color: string,
    lineWidth: number,
    dash: number[]
  ) {
    const context = this.context;
    context.save();
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.lineJoin = "round";
    context.setLineDash(dash);
    context.beginPath();

    if (shape.kind === "circle") {
      const [centerX, centerY] = this.stage.worldToScreen(...shape.position);
      context.arc(
        centerX,
        centerY,
        Math.abs(shape.radius * this.stage.zoom),
        0,
        Math.PI * 2
      );
    } else {
      const corners = getRectangleCorners(shape).map((corner) =>
        this.stage.worldToScreen(...corner)
      );
      context.moveTo(corners[0][0], corners[0][1]);
      for (let index = 1; index < corners.length; index++) {
        context.lineTo(corners[index][0], corners[index][1]);
      }
      context.closePath();
    }

    context.stroke();
    context.restore();
  }

  private drawWallEndpoints(
    object: Extract<LevelObjectData, { prefab: "wall" }>
  ) {
    const { start, end } = getWallEndpoints(object);
    const context = this.context;
    context.save();
    context.fillStyle = "rgb(24 24 27)";
    context.strokeStyle = "rgb(34 211 238)";
    context.lineWidth = 2;
    for (const endpoint of [start, end]) {
      const [x, y] = this.stage.worldToScreen(...endpoint);
      context.beginPath();
      context.arc(x, y, 5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  private drawSelectionBounds(
    objects: readonly LevelObjectData[],
    defaultWallThickness: number
  ) {
    const bounds = objects.reduce(
      (selection, object) => {
        const objectBounds = getLevelObjectBounds(object, defaultWallThickness);
        return {
          min: [
            Math.min(selection.min[0], objectBounds.min[0]),
            Math.min(selection.min[1], objectBounds.min[1]),
          ] as [number, number],
          max: [
            Math.max(selection.max[0], objectBounds.max[0]),
            Math.max(selection.max[1], objectBounds.max[1]),
          ] as [number, number],
        };
      },
      {
        min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as [
          number,
          number,
        ],
        max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY] as [
          number,
          number,
        ],
      }
    );
    const [left, top] = this.stage.worldToScreen(...bounds.min);
    const [right, bottom] = this.stage.worldToScreen(...bounds.max);
    this.context.save();
    this.context.strokeStyle = "rgb(34 211 238 / 75%)";
    this.context.lineWidth = 1;
    this.context.setLineDash([5, 4]);
    this.context.strokeRect(left, top, right - left, bottom - top);
    this.context.restore();
  }

  private drawWallDraft(draft: WallDraft) {
    const shape = wallDraftShape(draft);
    const context = this.context;
    context.save();
    context.strokeStyle = "rgb(34 211 238)";
    context.lineWidth = 2;

    if (shape.width < 1) {
      const [x, y] = this.stage.worldToScreen(...draft.start);
      context.beginPath();
      context.fillStyle = "rgb(24 24 27)";
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.restore();
      return;
    }

    const corners = getRectangleCorners(shape).map((corner) =>
      this.stage.worldToScreen(...corner)
    );
    context.fillStyle = "rgb(34 211 238 / 22%)";
    context.beginPath();
    context.moveTo(corners[0][0], corners[0][1]);
    for (let index = 1; index < corners.length; index++) {
      context.lineTo(corners[index][0], corners[index][1]);
    }
    context.closePath();
    context.fill();
    context.stroke();

    for (const endpoint of [draft.start, draft.end]) {
      const [x, y] = this.stage.worldToScreen(...endpoint);
      context.beginPath();
      context.fillStyle = "rgb(24 24 27)";
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }

    const midpoint = this.stage.worldToScreen(...shape.position);
    const angle = Math.round((shape.rotation * 180) / Math.PI);
    const label = `${Math.round(shape.width)} · ${angle}°`;
    context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    const labelWidth = context.measureText(label).width + 12;
    context.fillStyle = "rgb(24 24 27 / 92%)";
    context.fillRect(
      midpoint[0] - labelWidth / 2,
      midpoint[1] - 30,
      labelWidth,
      20
    );
    context.fillStyle = "rgb(165 243 252)";
    context.fillText(label, midpoint[0], midpoint[1] - 15);
    context.restore();
  }

  private drawMarquee({ start, end }: SelectionMarquee) {
    const startScreen = this.stage.worldToScreen(...start);
    const endScreen = this.stage.worldToScreen(...end);
    const left = Math.min(startScreen[0], endScreen[0]);
    const top = Math.min(startScreen[1], endScreen[1]);
    const width = Math.abs(endScreen[0] - startScreen[0]);
    const height = Math.abs(endScreen[1] - startScreen[1]);
    this.context.save();
    this.context.fillStyle = "rgb(34 211 238 / 10%)";
    this.context.strokeStyle = "rgb(34 211 238 / 80%)";
    this.context.lineWidth = 1;
    this.context.fillRect(left, top, width, height);
    this.context.strokeRect(left, top, width, height);
    this.context.restore();
  }

  private drawResizeAnchors(shape: LevelObjectShape) {
    const context = this.context;
    const size = 8;
    context.save();
    context.fillStyle = "rgb(24 24 27)";
    context.strokeStyle = "rgb(34 211 238)";
    context.lineWidth = 2;
    for (const anchor of getResizeAnchors(shape)) {
      const [x, y] = this.stage.worldToScreen(...anchor.position);
      context.fillRect(x - size / 2, y - size / 2, size, size);
      context.strokeRect(x - size / 2, y - size / 2, size, size);
    }
    context.restore();
  }

  private drawRotationHandle(shape: LevelObjectShape) {
    const context = this.context;
    const offset = 28 / Math.max(Math.abs(this.stage.zoom), 0.001);
    const handle = getRotationHandle(shape, offset);
    const [connectionX, connectionY] = this.stage.worldToScreen(
      ...handle.connection
    );
    const [handleX, handleY] = this.stage.worldToScreen(...handle.position);

    context.save();
    context.strokeStyle = "rgb(34 211 238)";
    context.fillStyle = "rgb(24 24 27)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(connectionX, connectionY);
    context.lineTo(handleX, handleY);
    context.stroke();
    context.beginPath();
    context.arc(handleX, handleY, 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }
}
