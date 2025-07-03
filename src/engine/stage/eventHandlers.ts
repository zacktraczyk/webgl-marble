import type Stage from ".";
import { VDU } from "../vdu/vdu";

export interface EventHandlers {
  pointerdown?: (event: PointerEvent) => void;
  pointermove?: (event: PointerEvent) => void;
  pointerup?: (event: PointerEvent) => void;
  wheel?: (event: WheelEvent) => void;
  pointerleave?: (event: PointerEvent) => void;
  //TODO: More
}

export interface DragAndDroppable {
  position: [number, number];
  grabHandleRadius: number;
  grabHandleColor: [number, number, number, number];
}

export class DragAndDropHandlers implements EventHandlers {
  private readonly _stage: Stage;
  private _draggingObject: DragAndDroppable | null = null;

  constructor(stage: Stage) {
    this._stage = stage;
  }

  pointerdown(event: PointerEvent) {
    const [x, y] = this._stage.mouseWorldPosition(event);
    const draggingObject = this._stage.objects.find((o) => {
      if ("grabHandleRadius" in o) {
        const [x1, y1] = o.position;
        const distance = Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2);
        return distance < o.grabHandleRadius;
      }
    }) as DragAndDroppable | undefined;
    if (!draggingObject) {
      this._draggingObject = null;
      return false;
    }

    this._draggingObject = draggingObject;
    // NOTE: This is used to prevent the pointermove event from panAndZoom
    // handlers... need a generic way to do this
    return true;
  }

  pointermove(event: PointerEvent) {
    if (!this._draggingObject) {
      return;
    }
    const [x, y] = this._stage.mouseWorldPosition(event);
    this._draggingObject.position = [x, y];
  }

  pointerup(event: PointerEvent) {
    this._draggingObject = null;
  }

  mouseleave(event: PointerEvent) {
    this._draggingObject = null;
  }
}

export class PanAndZoomHandlers implements EventHandlers {
  private _vdu: VDU;

  private _lastPos: [number, number] | null = null;
  private _lastZoom: number | null = null;
  private _isPanning = false;
  constructor(vdu: VDU) {
    this._vdu = vdu;
  }

  pointerdown(event: PointerEvent) {
    event.preventDefault();
    this._lastPos = [event.clientX, event.clientY];
    this._isPanning = true;
  }

  pointermove(event: PointerEvent) {
    if (!this._isPanning) {
      return;
    }

    const currentPos: [number, number] = [event.clientX, event.clientY];
    if (this._lastPos) {
      this._vdu.pan([
        currentPos[0] - this._lastPos[0],
        currentPos[1] - this._lastPos[1],
      ]);
    }
    this._lastPos = currentPos;
  }

  pointerup(event: PointerEvent) {
    event.preventDefault();
    this._lastPos = null;
    this._isPanning = false;
  }

  wheel(event: WheelEvent) {
    event.preventDefault();
    this._lastZoom = this._vdu.zoom;
    this._vdu.zoom = this._lastZoom + event.deltaY * 0.001;
    this._lastZoom = this._vdu.zoom;
  }

  mouseleave(event: PointerEvent) {
    this._lastPos = null;
    this._isPanning = false;
  }
}
