import type Stage from "../engine/stage";
import type { LevelObjectData } from "./levelDocument";
import {
  getLevelObjectShape,
  getRectangleCorners,
  getRotationHandle,
  getResizeAnchors,
  isLevelObjectRotatable,
  isLevelObjectResizable,
  type LevelObjectShape,
} from "./levelGeometry";

export type EditorOverlayState = {
  active: boolean;
  hoveredObject: LevelObjectData | null;
  selectedObject: LevelObjectData | null;
};

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

  render({ active, hoveredObject, selectedObject }: EditorOverlayState) {
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

    if (hoveredObject && hoveredObject.id !== selectedObject?.id) {
      this.strokeObject(hoveredObject, "rgb(244 244 245 / 88%)", 1.5, [5, 4]);
    }

    if (selectedObject) {
      this.strokeObject(selectedObject, "rgb(34 211 238)", 2, []);
      if (isLevelObjectResizable(selectedObject)) {
        this.drawResizeAnchors(getLevelObjectShape(selectedObject));
      }
      if (isLevelObjectRotatable(selectedObject)) {
        this.drawRotationHandle(getLevelObjectShape(selectedObject));
      }
    }
  }

  private strokeObject(
    object: LevelObjectData,
    color: string,
    lineWidth: number,
    dash: number[]
  ) {
    const shape = getLevelObjectShape(object);
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
