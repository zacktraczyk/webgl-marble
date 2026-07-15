import type { EntityDefinition } from "../core/definition";
import { Entity, type EntityId } from "../core/entity";
import type { Vec2 } from "../core/transform";
import { World } from "../core/world";
import Physics, { type CollisionEvents } from "../physics/physics";
import { debounce } from "../utils/utils";
import { VDU } from "../vdu/vdu";
import {
  CenterCameraOnResizeHandlers,
  DragAndDropHandlers,
  type DragAndDroppable,
  type EventHandlers,
  FitStageToWindowOnResizeHandlers,
  PanAndZoomHandlers,
} from "./eventHandlers";
import {
  calculateStageFit,
  type StageFitInsets,
  type StageFitInsetSource,
  uniformStageFitInsets,
} from "./fit";

export class Stage {
  private readonly _vdu: VDU;

  physicsEnabled: boolean = true;
  private readonly _physics: Physics;

  height: number;
  width: number;

  readonly world: World;
  private readonly _draggableEntities = new Map<EntityId, number>();

  // event handlers
  private readonly _panAndZoomHandlers: PanAndZoomHandlers;
  private readonly _dragAndDropHandlers: DragAndDropHandlers;
  private readonly _centerCameraOnResizeHandlers: CenterCameraOnResizeHandlers;
  private readonly _fitStageToWindowOnResizeHandlers: FitStageToWindowOnResizeHandlers;

  private _canvasRegisteredEventHandlers: EventHandlers = {};
  private _windowRegisteredEventHandlers: EventHandlers = {};
  private _isPanAndZoomEnabled = false;
  private _isDragAndDropEnabled = false;
  private _isCenterCameraOnResizeEnabled = false;
  private _isFitStageToWindowOnResizeEnabled = false;

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
    this.world = new World();
    this.world.onDestroy((entity) => {
      this._physics.removeEntity(entity.id);
      this._vdu.removeEntity(entity.id);
      this._draggableEntities.delete(entity.id);
    });
    this._panAndZoomHandlers = new PanAndZoomHandlers(vdu);
    this._dragAndDropHandlers = new DragAndDropHandlers(this);
    this._centerCameraOnResizeHandlers = new CenterCameraOnResizeHandlers(vdu);
    this._fitStageToWindowOnResizeHandlers =
      new FitStageToWindowOnResizeHandlers(vdu, this);
    this.centerStage();
  }

  /**
   * Preferred creation path. The stage is the composition root that registers
   * neutral entity data with otherwise independent physics/rendering systems.
   */
  spawn(definition: EntityDefinition): Entity {
    const entity = this.world.create(definition);
    if (definition.physics) {
      this._physics.addEntity(entity.id, entity.transform, definition.physics);
    }
    if (definition.render) {
      this._vdu.addEntity(entity.id, entity.transform, definition.render);
    }
    return entity;
  }

  destroy(entity: EntityId | Entity) {
    this.world.destroy(typeof entity === "number" ? entity : entity.id);
  }

  getPhysicsEntity(entity: EntityId | Entity) {
    return this._physics.getEntity(
      typeof entity === "number" ? entity : entity.id
    );
  }

  update(elapsed: number) {
    this.world.updateHierarchy();
    if (this.physicsEnabled) {
      this._physics.update(elapsed);
    }
    this.world.updateHierarchy();
    this.world.flushDestruction();
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

  panByScreen(deltaX: number, deltaY: number) {
    this._vdu.camera.position[0] += deltaX;
    this._vdu.camera.position[1] += deltaY;
  }

  zoomAtScreenPoint(screenX: number, screenY: number, zoom: number) {
    const [worldX, worldY] = this.screenToWorld(screenX, screenY);
    this._vdu.zoom = zoom;
    this._vdu.camera.position[0] = screenX - worldX * zoom;
    this._vdu.camera.position[1] = screenY - worldY * zoom;
  }

  private _registerEventHandlers() {
    if (this.isEventHandlersRegistered) {
      console.error(
        "VDU: Pan and zoom handlers already registered. Skipping _registerEventHandlers."
      );
      return;
    }

    // TODO: Genericize event handlers to for loop over all event handlers
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
        this._dragAndDropHandlers.pointerup();
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

    const pointerleave = () => {
      if (this._isDragAndDropEnabled) {
        this._dragAndDropHandlers.mouseleave();
      }
      if (this._isPanAndZoomEnabled) {
        this._panAndZoomHandlers.mouseleave();
      }
    };

    this.canvas.addEventListener("pointerdown", pointerdown);
    this.canvas.addEventListener("pointermove", pointermove);
    this.canvas.addEventListener("pointerup", pointerup);
    this.canvas.addEventListener("wheel", wheel);
    this.canvas.addEventListener("pointerleave", pointerleave);

    const resize = () => {
      if (this._isCenterCameraOnResizeEnabled) {
        this._centerCameraOnResizeHandlers.resize();
      }
      if (this._isFitStageToWindowOnResizeEnabled) {
        this._fitStageToWindowOnResizeHandlers.resize();
      }
    };
    const debouncedResize = debounce(resize, 300);

    window.addEventListener("resize", debouncedResize);

    this._canvasRegisteredEventHandlers = {
      pointerdown,
      pointermove,
      pointerup,
      wheel,
      pointerleave,
    };
    this._windowRegisteredEventHandlers = { resize: debouncedResize };
    // TODO: Touch pan & zoom
  }

  private get isEventHandlersRegistered() {
    return Object.keys(this._canvasRegisteredEventHandlers).length > 0;
  }

  // TODO: Unregister handlers when VDU is destroyed
  private _unregisterEventHandlers() {
    if (!this.isEventHandlersRegistered) {
      console.warn("VDU: Pan and zoom handlers not registered");
      return;
    }

    for (const [name, handler] of Object.entries(
      this._canvasRegisteredEventHandlers
    )) {
      this.canvas.removeEventListener(name, handler);
    }

    for (const [name, handler] of Object.entries(
      this._windowRegisteredEventHandlers
    )) {
      window.removeEventListener(name, handler);
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

  set centerCameraOnResize(value: boolean) {
    if (this._isCenterCameraOnResizeEnabled === value) {
      return;
    }

    if (value) {
      if (!this.isEventHandlersRegistered) {
        this._registerEventHandlers();
      }
      this._centerCameraOnResizeHandlers.resize();
      this._isCenterCameraOnResizeEnabled = true;
    } else {
      this._isCenterCameraOnResizeEnabled = false;
    }
  }

  set fitStageToWindowOnResize(value: boolean) {
    if (this._isFitStageToWindowOnResizeEnabled === value) {
      return;
    }
    if (value) {
      if (!this.isEventHandlersRegistered) {
        this._registerEventHandlers();
      }
      this._fitStageToWindowOnResizeHandlers.resize();
      this._isFitStageToWindowOnResizeEnabled = true;
    } else {
      this._isFitStageToWindowOnResizeEnabled = false;
    }
  }

  set fitStageToWindowOnResizePadding(value: number) {
    this._fitStageToWindowOnResizeHandlers.padding = value;
  }

  get fitStageToWindowOnResizePadding() {
    return this._fitStageToWindowOnResizeHandlers.padding;
  }

  set fitStageToWindowOnResizeInsets(value: StageFitInsetSource | null) {
    this._fitStageToWindowOnResizeHandlers.insets = value;
  }

  get fitStageToWindowOnResizeInsets() {
    return this._fitStageToWindowOnResizeHandlers.insets;
  }

  centerStage() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this._vdu.camera.position[0] = width / 2;
    this._vdu.camera.position[1] = height / 2;
  }

  fitStageToWindow(paddingOrInsets: number | StageFitInsets = 0) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const insets =
      typeof paddingOrInsets === "number"
        ? uniformStageFitInsets(paddingOrInsets)
        : paddingOrInsets;
    const fit = calculateStageFit({
      viewportWidth: width,
      viewportHeight: height,
      stageWidth: this.width,
      stageHeight: this.height,
      insets,
    });
    this._vdu.zoom = fit.zoom;
    this._vdu.camera.position = fit.cameraPosition;
  }

  setSize(width: number, height: number) {
    if (
      !Number.isFinite(width) ||
      width <= 0 ||
      !Number.isFinite(height) ||
      height <= 0
    ) {
      throw new Error("Stage dimensions must be positive finite numbers");
    }
    this.width = width;
    this.height = height;
  }

  mouseWorldPosition(event: PointerEvent) {
    const screenX = event.clientX - this.canvas.getBoundingClientRect().left;
    const screenY = event.clientY - this.canvas.getBoundingClientRect().top;
    const [x, y] = this.screenToWorld(screenX, screenY);
    return [x, y];
  }

  screenToWorld(screenX: number, screenY: number): Vec2 {
    return [
      (screenX - this._vdu.camera.position[0]) / this.zoom,
      (screenY - this._vdu.camera.position[1]) / this.zoom,
    ];
  }

  worldToScreen(worldX: number, worldY: number): Vec2 {
    // TODO: Verify this is correct... should be the inverse of screenToWorld ?
    return [
      worldX * this.zoom + this._vdu.camera.position[0],
      worldY * this.zoom + this._vdu.camera.position[1],
    ];
  }

  clearOutOfBoundsEntities(outOfBoundsPadding = 1000) {
    const removed: Entity[] = [];
    for (const entity of this.world.entities) {
      if (entity.markedForDeletion) {
        continue;
      }
      if (
        entity.position[0] < -this.width / 2 - outOfBoundsPadding ||
        entity.position[0] > this.width / 2 + outOfBoundsPadding ||
        entity.position[1] < -this.height / 2 - outOfBoundsPadding ||
        entity.position[1] > this.height / 2 + outOfBoundsPadding
      ) {
        entity.delete();
        removed.push(entity);
      }
    }
    return removed;
  }

  get entities() {
    return this.world.entities;
  }

  setDraggable(entity: EntityId | Entity, grabHandleRadius: number) {
    if (!Number.isFinite(grabHandleRadius) || grabHandleRadius <= 0) {
      throw new Error("A draggable entity requires a positive handle radius");
    }
    const id = typeof entity === "number" ? entity : entity.id;
    if (!this.world.has(id)) {
      throw new Error("Cannot make an entity draggable outside this stage");
    }
    this._draggableEntities.set(id, grabHandleRadius);
  }

  get draggableEntities(): readonly DragAndDroppable[] {
    return [...this._draggableEntities].flatMap(([id, grabHandleRadius]) => {
      const entity = this.world.get(id);
      return entity ? [{ entity, grabHandleRadius }] : [];
    });
  }

  get canvas() {
    return this._vdu.canvas;
  }

  set drawMode(mode: "TRIANGLES" | "LINES") {
    this._vdu.drawMode = mode;
  }

  get drawMode() {
    return this._vdu.drawMode;
  }

  registerPhysicsObserver(observer: (data: CollisionEvents) => void) {
    this._physics.register(observer);
  }

  unregisterPhysicsObserver(observer: (data: CollisionEvents) => void) {
    this._physics.unregister(observer);
  }

  dispose() {
    if (this.isEventHandlersRegistered) {
      this._unregisterEventHandlers();
    }
    for (const entity of this.world.entities) {
      entity.delete();
    }
    this.world.flushDestruction();
    this._draggableEntities.clear();
    this._physics.dispose();
    this._vdu.dispose();
  }
}

export default Stage;
