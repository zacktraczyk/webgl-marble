import { Physical } from "./physics/entity";
import Physics from "./physics/physics";
import { Drawable } from "./vdu/entity";
import { VDU } from "./vdu/vdu";

export interface StageObject extends Drawable, Physical {
  // id: string;
  position: [number, number];
  sync(): void;
  delete(): void;
}

class Stage {
  // TODO:
  private readonly _vdu: VDU;
  private readonly _physics: Physics;

  // readonly height: number;
  // readonly width: number;

  private _objects: StageObject[];

  constructor({
    // width = 600,
    // height = 600,
    physics,
    ...rest
  }: {
    width?: number;
    height?: number;
    physics?: Physics;
  } & ({ vdu: VDU } | { canvas: HTMLCanvasElement | string })) {
    // this.height = height;
    // this.width = width;

    this._vdu = "canvas" in rest ? new VDU(rest.canvas) : rest.vdu;
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

  sync() {
    for (const object of this._objects) {
      object.sync();
    }
  }

  update(elapsed: number) {
    this._physics.update(elapsed);
    this.sync();
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
}

export default Stage;
