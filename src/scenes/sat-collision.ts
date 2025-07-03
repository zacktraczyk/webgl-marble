import { Circle } from "../engine/object/circle";
import { Rectangle } from "../engine/object/rectangle";
import Stage from "../engine/Stage";
import { createCircle, type DrawEntity } from "../engine/vdu/entity";

function main() {
  const stage = new DragAndDropStage();

  const centerX = stage.canvas.clientWidth / 2;
  const centerY = stage.canvas.clientHeight / 2;
  const offsetX = 200;

  const circle1 = new DragAndDropCircle({
    position: [centerX + offsetX, centerY],
    radius: 50,
    physicsType: "kinematic",
    color: [34 / 255, 197 / 255, 94 / 255, 1],
    handleRadius: 15,
    handleColor: [0.4, 0.4, 0.4, 1],
  });
  stage.add(circle1);

  const square1 = new DragAndDropRectangle({
    position: [centerX - offsetX, centerY],
    width: 100,
    height: 100,
    rotation: Math.PI / 8,
    physicsType: "kinematic",
    color: [239 / 255, 68 / 255, 68 / 255, 1],
    handleRadius: 15,
    handleColor: [0.4, 0.4, 0.4, 1],
  });
  stage.add(square1);

  console.log(square1.position);

  const collisions: [number, number][] = [];
  stage.registerPhysicsObserver(({ collisions: newCollisions }) => {
    for (const collision of newCollisions) {
      const alreadyCollided = collisions.some(
        (c) => c[0] === collision[0].id && c[1] === collision[1].id
      );
      if (alreadyCollided) {
        continue;
      }

      collisions.push([collision[0].id, collision[1].id]);
    }
  });

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    stage.update(elapsed);
    updateFpsPerf();
    updateDebugInfo({ collisions, isDragging: !!stage.draggingObject });
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

class DragAndDropStage extends Stage {
  draggingObject: DragAndDropRectangle | DragAndDropCircle | null = null;

  constructor(params?: ConstructorParameters<typeof Stage>[0]) {
    super(params);

    this._registerDragAndDrop();
  }

  mouseWorldPosition(e: MouseEvent) {
    const screenX = e.clientX - this.canvas.getBoundingClientRect().left;
    const screenY = e.clientY - this.canvas.getBoundingClientRect().top;
    const [x, y] = this.screenToWorld(screenX, screenY);
    return [x, y];
  }

  private _mouseDown: ((mouseEvent: MouseEvent) => void) | null = null;
  private _mouseMove: ((mouseEvent: MouseEvent) => void) | null = null;
  private _mouseUp: (() => void) | null = null;
  private _registerDragAndDrop() {
    const mouseDown = (mouseEvent: MouseEvent) => {
      const [x, y] = this.mouseWorldPosition(mouseEvent);
      this.draggingObject = this.objects.find((o) => {
        if (
          o instanceof DragAndDropRectangle ||
          o instanceof DragAndDropCircle
        ) {
          const [x1, y1] = o.position;
          const distance = Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2);
          return distance < o.grabHandleRadius;
        }
      }) as DragAndDropRectangle | DragAndDropCircle | null;
    };

    const mouseMove = (mouseEvent: MouseEvent) => {
      if (!this.draggingObject) {
        return;
      }
      const [x, y] = this.mouseWorldPosition(mouseEvent);
      this.draggingObject.position = [x, y];
    };

    const mouseUp = () => {
      this.draggingObject = null;
    };

    this._mouseDown = mouseDown;
    this._mouseMove = mouseMove;
    this._mouseUp = mouseUp;
    this.canvas.addEventListener("mousedown", mouseDown);
    this.canvas.addEventListener("mousemove", mouseMove);
    this.canvas.addEventListener("mouseup", mouseUp);
  }

  private _unregisterDragAndDrop() {
    if (this._mouseDown) {
      this.canvas.removeEventListener("mousedown", this._mouseDown);
      this._mouseDown = null;
    }
    if (this._mouseMove) {
      this.canvas.removeEventListener("mousemove", this._mouseMove);
      this._mouseMove = null;
    }
    if (this._mouseUp) {
      this.canvas.removeEventListener("mouseup", this._mouseUp);
      this._mouseUp = null;
    }
  }
}

type DragAndDropRectangleParams = ConstructorParameters<typeof Rectangle>[0] & {
  handleRadius: number;
  handleColor: [number, number, number, number];
};

class DragAndDropRectangle extends Rectangle {
  grabHandleRadius: number;
  grabHandleColor: [number, number, number, number];
  private _grabHandleDrawEntity: DrawEntity | null = null;

  constructor({
    handleRadius,
    handleColor,
    ...rest
  }: DragAndDropRectangleParams) {
    super(rest);
    this.grabHandleRadius = handleRadius;
    this.grabHandleColor = handleColor;
  }

  get drawEntities() {
    const entities = super.drawEntities;
    if (!this._grabHandleDrawEntity) {
      const entity = createCircle(this, this.grabHandleRadius);
      this._grabHandleDrawEntity = entity;
    }

    return [...entities, this._grabHandleDrawEntity];
  }

  delete() {
    super.delete();
    if (this._grabHandleDrawEntity) {
      this._grabHandleDrawEntity.delete();
    }
  }

  sync() {
    super.sync();
    if (this._grabHandleDrawEntity) {
      this._grabHandleDrawEntity.position = this.position;
      // TODO: fixup method of radius scaling
      // this._grabHandleDrawEntity.scale = [
      //   this.grabHandleRadius,
      //   this.grabHandleRadius,
      // ];
      this._grabHandleDrawEntity.color = this.grabHandleColor;
    }
  }
}

type DragAndDropCircleParams = ConstructorParameters<typeof Circle>[0] & {
  handleRadius: number;
  handleColor: [number, number, number, number];
};

class DragAndDropCircle extends Circle {
  grabHandleRadius: number;
  grabHandleColor: [number, number, number, number];
  private _grabHandleDrawEntity: DrawEntity | null = null;

  constructor({ handleRadius, handleColor, ...rest }: DragAndDropCircleParams) {
    super(rest);
    this.grabHandleRadius = handleRadius;
    this.grabHandleColor = handleColor;
  }

  get drawEntities() {
    const entities = super.drawEntities;
    if (!this._grabHandleDrawEntity) {
      const entity = createCircle(this, this.grabHandleRadius);
      this._grabHandleDrawEntity = entity;
    }

    return [...entities, this._grabHandleDrawEntity];
  }

  delete() {
    super.delete();
    if (this._grabHandleDrawEntity) {
      this._grabHandleDrawEntity.delete();
    }
  }

  sync() {
    super.sync();
    if (this._grabHandleDrawEntity) {
      this._grabHandleDrawEntity.position = this.position;
      this._grabHandleDrawEntity.color = this.grabHandleColor;
    }
  }
}

// Debug info
const debugInfoElem = document.getElementById("#debug-info");
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const updateDebugInfo = (obj: any) => {
  if (debugInfoElem) {
    debugInfoElem.textContent = JSON.stringify(obj, null, 2);
  }
};

// FPS Counter
const fpsElem = document.getElementById("#fps");
let lastTime = performance.now();
let frameCount = 0;
const updateFpsPerf = () => {
  const now = performance.now();
  const delta = now - lastTime;
  frameCount++;

  if (delta > 500) {
    const fps = (frameCount / delta) * 1000;
    if (fpsElem) {
      fpsElem.textContent = `FPS: ${fps.toFixed(2)}`;
    }
    lastTime = now;
    frameCount = 0;
  }
};

export default main;
