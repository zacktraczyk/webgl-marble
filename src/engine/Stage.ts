import { PhysicsEntity, type Physical } from "./physics/entity";
import Physics, { type CollisionEvents } from "./physics/physics";
import { DrawEntity, type Drawable } from "./vdu/entity";
import { VDU } from "./vdu/vdu";

export type StageObject = {
  // id: string;
  position: [number, number];
  markedForDeletion: boolean;
  sync(): void;
  delete(): void;
} & (Drawable | Physical | {});

class Stage {
  // TODO:
  private readonly _vdu: VDU;
  private readonly _physics: Physics;

  readonly height: number;
  readonly width: number;

  private _objects: StageObject[];

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

  set panAndZoom(boolean: boolean) {
    this._vdu.panAndZoom = boolean;
  }

  screenToWorld(screenX: number, screenY: number) {
    // TODO: Remove from VDU and keep in Stage
    return this._vdu.screenToWorld(screenX, screenY);
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
