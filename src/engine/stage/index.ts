import { type Physical } from "../physics/entity";
import Physics, { type CollisionEvents } from "../physics/physics";
import { type Drawable } from "../vdu/entity";
import { VDU } from "../vdu/vdu";
import {
  DragAndDropHandlers,
  type DragAndDroppable,
  type EventHandlers,
  PanAndZoomHandlers,
} from "./eventHandlers";

export type StageObject = {
  // id: string;
  position: [number, number];
  markedForDeletion: boolean;
  sync(): void;
  delete(): void;
} & (Drawable | Physical | DragAndDroppable);

class Stage {
  private readonly _vdu: VDU;
  private readonly _physics: Physics;

  readonly height: number;
  readonly width: number;

  private _objects: StageObject[];

  // event handlers
  private _registeredEventHandlers: EventHandlers = {};
  private _isPanAndZoomEnabled = false;
  private readonly _panAndZoomHandlers: PanAndZoomHandlers;
  private _isDragAndDropEnabled = false;
  private readonly _dragAndDropHandlers: DragAndDropHandlers;

  constructor({
    width = 600,
    height = 600,
    physics,
    vdu: vduParam,
  }: {
    width?: number;
    height?: number;
    physics?: Physics;
    vdu?: VDU | { canvas: HTMLCanvasElement | string };
  } = {}) {
    this.height = height;
    this.width = width;

    let vdu: VDU;
    if (vduParam) {
      if (vduParam instanceof VDU) {
        vdu = vduParam;
      } else {
        vdu = new VDU(vduParam.canvas);
      }
    } else {
      vdu = new VDU("#gl-canvas");
    }
    this._vdu = vdu;

    this._physics = physics ?? new Physics();
    this._objects = [];
    this._panAndZoomHandlers = new PanAndZoomHandlers(vdu);
    this._dragAndDropHandlers = new DragAndDropHandlers(this);
  }

  add(object: StageObject) {
    if ("drawEntities" in object) {
      this._vdu.add(object);
    }
    if ("physicsEntity" in object) {
      this._physics.add(object);
    }
    this._objects.push(object);
  }

  private _cleanup() {
    const filteredObjects = this._objects.filter(
      (object) => !object.markedForDeletion
    );
    this._objects = filteredObjects;
  }

  private _sync() {
    for (const object of this._objects) {
      object.sync();
    }
  }

  update(elapsed: number) {
    this._cleanup();
    this._physics.update(elapsed);
    this._sync();
  }

  render() {
    this._vdu.render();
  }

  set zoom(value: number) {
    this._vdu.zoom = value;
  }

  get zoom() {
    return this._vdu.zoom;
  }

  // private _panAndZoomHandlers: { [name: string]: (event?: any) => void } = {};
  private _registerEventHandlers() {
    if (this.isEventHandlersRegistered) {
      console.error(
        "VDU: Pan and zoom handlers already registered. Skipping _registerEventHandlers."
      );
      return;
    }

    const pointerdown = (event: PointerEvent) => {
      event.preventDefault();
      if (this._isDragAndDropEnabled) {
        const isDragging = this._dragAndDropHandlers.pointerdown(event);
        if (isDragging) {
          return;
        }
      }
      if (this._isPanAndZoomEnabled) {
        this._panAndZoomHandlers.pointerdown(event);
      }
    };

    const pointermove = (event: PointerEvent) => {
      event.preventDefault();
      if (this._isDragAndDropEnabled) {
        this._dragAndDropHandlers.pointermove(event);
      }
      if (this._isPanAndZoomEnabled) {
        this._panAndZoomHandlers.pointermove(event);
      }
    };

    const pointerup = (event: PointerEvent) => {
      event.preventDefault();
      if (this._isDragAndDropEnabled) {
        this._dragAndDropHandlers.pointerup(event);
      }
      if (this._isPanAndZoomEnabled) {
        this._panAndZoomHandlers.pointerup(event);
      }
    };

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (this._isPanAndZoomEnabled) {
        this._panAndZoomHandlers.wheel(event);
      }
    };

    const pointerleave = (event: PointerEvent) => {
      if (this._isDragAndDropEnabled) {
        this._dragAndDropHandlers.mouseleave(event);
      }
      if (this._isPanAndZoomEnabled) {
        this._panAndZoomHandlers.mouseleave(event);
      }
    };

    this.canvas.addEventListener("pointerdown", pointerdown);
    this.canvas.addEventListener("pointermove", pointermove);
    this.canvas.addEventListener("pointerup", pointerup);
    this.canvas.addEventListener("wheel", wheel);
    this.canvas.addEventListener("pointerleave", pointerleave);

    this._registeredEventHandlers = {
      pointerdown,
      pointermove,
      pointerup,
      wheel,
      pointerleave,
    };
    // TODO: Touch pan & zoom
  }

  private get isEventHandlersRegistered() {
    return Object.keys(this._registeredEventHandlers).length > 0;
  }

  // TODO: Unregister handlers when VDU is destroyed
  private _unregisterEventHandlers() {
    if (!this.isEventHandlersRegistered) {
      console.warn("VDU: Pan and zoom handlers not registered");
      return;
    }

    for (const [name, handler] of Object.entries(
      this._registeredEventHandlers
    )) {
      this.canvas.removeEventListener(name, handler);
    }
  }

  set panAndZoom(value: boolean) {
    if (this._isPanAndZoomEnabled === value) {
      return;
    }

    if (value) {
      if (!this.isEventHandlersRegistered) {
        this._registerEventHandlers();
      }
      this._isPanAndZoomEnabled = true;
    } else {
      this._isPanAndZoomEnabled = false;
    }
  }

  get panAndZoom() {
    return this._isPanAndZoomEnabled;
  }

  set dragAndDrop(value: boolean) {
    if (this._isDragAndDropEnabled === value) {
      return;
    }

    if (value) {
      if (!this.isEventHandlersRegistered) {
        this._registerEventHandlers();
      }
      this._isDragAndDropEnabled = true;
    } else {
      this._isDragAndDropEnabled = false;
    }
  }

  get dragAndDrop() {
    return this._isDragAndDropEnabled;
  }

  mouseWorldPosition(event: PointerEvent) {
    const screenX = event.clientX - this.canvas.getBoundingClientRect().left;
    const screenY = event.clientY - this.canvas.getBoundingClientRect().top;
    const [x, y] = this.screenToWorld(screenX, screenY);
    return [x, y];
  }

  screenToWorld(screenX: number, screenY: number) {
    return [
      screenX / this.zoom - this._vdu.camera.position[0],
      screenY / this.zoom - this._vdu.camera.position[1],
    ];
  }

  worldToScreen(worldX: number, worldY: number) {
    return [
      worldX * this.zoom + this._vdu.camera.position[0],
      worldY * this.zoom + this._vdu.camera.position[1],
    ];
  }

  clearOutOfBoundsObjects() {
    // TODO: Set as parameter
    const outOfBoundsPadding = 1000;

    for (const object of this._objects) {
      if (
        object.position[0] < -outOfBoundsPadding ||
        object.position[0] > this._vdu.canvas.width + outOfBoundsPadding ||
        object.position[1] < -outOfBoundsPadding ||
        object.position[1] > this._vdu.canvas.height + outOfBoundsPadding
      ) {
        object.delete();
        this._objects.splice(this._objects.indexOf(object), 1);
      }
    }
  }

  get objects() {
    return this._objects;
  }

  get canvas() {
    return this._vdu.canvas;
  }

  registerPhysicsObserver(observer: (data: CollisionEvents) => void) {
    this._physics.register(observer);
  }

  unregisterPhysicsObserver(observer: (data: CollisionEvents) => void) {
    this._physics.unregister(observer);
  }
}

export default Stage;
