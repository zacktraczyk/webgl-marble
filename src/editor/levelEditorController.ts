import type { Vec2 } from "../engine/core/transform";
import type Stage from "../engine/stage";
import type { LevelObjectData } from "./levelDocument";
import {
  applyLevelObjectShape,
  getLevelObjectShape,
  getResizeAnchors,
  isLevelObjectResizable,
  moveShape,
  pickLevelObject,
  resizeHandleCursor,
  resizeShape,
  type LevelObjectShape,
  type ResizeHandle,
} from "./levelGeometry";

type EditorCallbacks = {
  onObjectChange(object: LevelObjectData): void;
  onObjectCommit(object: LevelObjectData): void;
  onDelete(object: LevelObjectData): void;
};

type DragState = {
  objectId: string;
  mode: "move" | "resize";
  handle?: ResizeHandle;
  startShape: LevelObjectShape;
  startWorld: Vec2;
  startScreen: Vec2;
  changed: boolean;
};

const POSITION_SNAP_STEP = 25;
const SIZE_SNAP_STEP = 5;
const HANDLE_HIT_RADIUS = 8;
const DRAG_THRESHOLD = 2;

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement);

export class LevelEditorController {
  private readonly stage: Stage;
  private readonly getObjects: () => readonly LevelObjectData[];
  private readonly callbacks: EditorCallbacks;
  private dragState: DragState | null = null;
  private enabled = false;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;

  constructor({
    stage,
    getObjects,
    callbacks,
    signal,
  }: {
    stage: Stage;
    getObjects: () => readonly LevelObjectData[];
    callbacks: EditorCallbacks;
    signal: AbortSignal;
  }) {
    this.stage = stage;
    this.getObjects = getObjects;
    this.callbacks = callbacks;

    stage.canvas.addEventListener("pointerdown", this.pointerDown, { signal });
    stage.canvas.addEventListener("pointermove", this.pointerMove, { signal });
    stage.canvas.addEventListener("pointerup", this.pointerUp, { signal });
    stage.canvas.addEventListener("pointercancel", this.pointerUp, { signal });
    stage.canvas.addEventListener("pointerleave", this.pointerLeave, {
      signal,
    });
    window.addEventListener("keydown", this.keyDown, { signal });
  }

  setActive(active: boolean) {
    this.enabled = active;
    if (!active) {
      this.dragState = null;
      this.hoveredId = null;
      this.stage.canvas.style.cursor = "";
    }
  }

  get isActive() {
    return this.enabled;
  }

  get selectedObject() {
    return this.findObject(this.selectedId);
  }

  get hoveredObject() {
    return this.findObject(this.hoveredId);
  }

  private findObject(id: string | null) {
    if (!id) {
      return null;
    }
    return this.getObjects().find((object) => object.id === id) ?? null;
  }

  private screenPoint(event: PointerEvent): Vec2 {
    const bounds = this.stage.canvas.getBoundingClientRect();
    return [event.clientX - bounds.left, event.clientY - bounds.top];
  }

  private worldPoint([x, y]: Vec2): Vec2 {
    const [worldX, worldY] = this.stage.screenToWorld(x, y);
    return [worldX, worldY];
  }

  private resizeHandleAt(object: LevelObjectData, [screenX, screenY]: Vec2) {
    if (!isLevelObjectResizable(object)) {
      return null;
    }
    const shape = getLevelObjectShape(object);
    for (const anchor of getResizeAnchors(shape)) {
      const [anchorX, anchorY] = this.stage.worldToScreen(...anchor.position);
      if (
        Math.hypot(anchorX - screenX, anchorY - screenY) <= HANDLE_HIT_RADIUS
      ) {
        return anchor.handle;
      }
    }
    return null;
  }

  private beginDrag(
    object: LevelObjectData,
    mode: DragState["mode"],
    startScreen: Vec2,
    handle?: ResizeHandle
  ) {
    this.dragState = {
      objectId: object.id,
      mode,
      handle,
      startShape: getLevelObjectShape(object),
      startWorld: this.worldPoint(startScreen),
      startScreen,
      changed: false,
    };
  }

  private readonly pointerDown = (event: PointerEvent) => {
    if (!this.enabled || event.button !== 0) {
      return;
    }

    const screenPoint = this.screenPoint(event);
    const selectedObject = this.selectedObject;
    const resizeHandle = selectedObject
      ? this.resizeHandleAt(selectedObject, screenPoint)
      : null;

    if (selectedObject && resizeHandle) {
      this.beginDrag(selectedObject, "resize", screenPoint, resizeHandle);
      this.stage.canvas.style.cursor = resizeHandleCursor(resizeHandle);
    } else {
      const pickedObject = pickLevelObject(
        this.getObjects(),
        this.worldPoint(screenPoint)
      );
      if (!pickedObject) {
        this.selectedId = null;
        this.hoveredId = null;
        this.dragState = null;
        this.stage.canvas.style.cursor = "default";
        return;
      }
      this.selectedId = pickedObject.id;
      this.hoveredId = pickedObject.id;
      this.beginDrag(pickedObject, "move", screenPoint);
      this.stage.canvas.style.cursor = "grabbing";
    }

    this.stage.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private readonly pointerMove = (event: PointerEvent) => {
    if (!this.enabled) {
      return;
    }

    const screenPoint = this.screenPoint(event);
    if (!this.dragState) {
      this.updateIdleState(screenPoint);
      return;
    }

    const screenDistance = Math.hypot(
      screenPoint[0] - this.dragState.startScreen[0],
      screenPoint[1] - this.dragState.startScreen[1]
    );
    if (!this.dragState.changed && screenDistance < DRAG_THRESHOLD) {
      return;
    }

    const object = this.findObject(this.dragState.objectId);
    if (!object) {
      this.dragState = null;
      return;
    }

    this.dragState.changed = true;
    const worldPoint = this.worldPoint(screenPoint);
    let nextShape: LevelObjectShape;
    if (this.dragState.mode === "move") {
      const targetPosition: Vec2 = [
        this.dragState.startShape.position[0] +
          worldPoint[0] -
          this.dragState.startWorld[0],
        this.dragState.startShape.position[1] +
          worldPoint[1] -
          this.dragState.startWorld[1],
      ];
      nextShape = moveShape(
        this.dragState.startShape,
        targetPosition,
        event.altKey ? 0 : POSITION_SNAP_STEP
      );
      this.stage.canvas.style.cursor = "grabbing";
    } else {
      const handle = this.dragState.handle;
      if (!handle) {
        return;
      }
      nextShape = resizeShape(
        this.dragState.startShape,
        handle,
        worldPoint,
        event.altKey ? 0 : SIZE_SNAP_STEP
      );
      this.stage.canvas.style.cursor = resizeHandleCursor(handle);
    }

    applyLevelObjectShape(object, nextShape);
    this.callbacks.onObjectChange(object);
    event.preventDefault();
  };

  private readonly pointerUp = (event: PointerEvent) => {
    if (!this.enabled || !this.dragState) {
      return;
    }

    const object = this.findObject(this.dragState.objectId);
    if (object && this.dragState.changed) {
      this.callbacks.onObjectCommit(object);
    }
    this.dragState = null;
    if (this.stage.canvas.hasPointerCapture(event.pointerId)) {
      this.stage.canvas.releasePointerCapture(event.pointerId);
    }
    this.updateIdleState(this.screenPoint(event));
  };

  private readonly pointerLeave = () => {
    if (!this.enabled || this.dragState) {
      return;
    }
    this.hoveredId = null;
    this.stage.canvas.style.cursor = "default";
  };

  private updateIdleState(screenPoint: Vec2) {
    const selectedObject = this.selectedObject;
    const handle = selectedObject
      ? this.resizeHandleAt(selectedObject, screenPoint)
      : null;
    if (handle) {
      this.hoveredId = selectedObject?.id ?? null;
      this.stage.canvas.style.cursor = resizeHandleCursor(handle);
      return;
    }

    const hoveredObject = pickLevelObject(
      this.getObjects(),
      this.worldPoint(screenPoint)
    );
    this.hoveredId = hoveredObject?.id ?? null;
    this.stage.canvas.style.cursor = hoveredObject ? "grab" : "default";
  }

  private readonly keyDown = (event: KeyboardEvent) => {
    if (!this.enabled || isTypingTarget(event.target)) {
      return;
    }

    if (event.key === "Escape") {
      this.dragState = null;
      this.selectedId = null;
      this.hoveredId = null;
      event.preventDefault();
      return;
    }

    const object = this.selectedObject;
    if (!object) {
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      this.dragState = null;
      this.callbacks.onDelete(object);
      this.selectedId = null;
      this.hoveredId = null;
      event.preventDefault();
      return;
    }

    const directionByKey: Partial<Record<string, Vec2>> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directionByKey[event.key];
    if (!direction) {
      return;
    }

    const distance = event.shiftKey ? 10 : 1;
    const shape = getLevelObjectShape(object);
    const nextPosition: Vec2 = [
      shape.position[0] + direction[0] * distance,
      shape.position[1] + direction[1] * distance,
    ];
    applyLevelObjectShape(object, moveShape(shape, nextPosition));
    this.callbacks.onObjectChange(object);
    this.callbacks.onObjectCommit(object);
    event.preventDefault();
  };
}
