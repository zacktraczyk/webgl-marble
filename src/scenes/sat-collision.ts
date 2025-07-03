import { Circle } from "../engine/object/circle";
import { Rectangle } from "../engine/object/rectangle";
import Stage from "../engine/stage";
import { type DragAndDroppable } from "../engine/stage/eventHandlers";
import { createCircle, type DrawEntity } from "../engine/vdu/entity";

function main() {
  const stage = new Stage();
  stage.dragAndDrop = true;
  stage.panAndZoom = true;

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
    updateDebugInfo({ collisions });
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

type DragAndDropRectangleParams = ConstructorParameters<typeof Rectangle>[0] & {
  handleRadius: number;
  handleColor: [number, number, number, number];
};

class DragAndDropRectangle extends Rectangle implements DragAndDroppable {
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
      this._grabHandleDrawEntity.color = this.grabHandleColor;
    }
  }
}

type DragAndDropCircleParams = ConstructorParameters<typeof Circle>[0] & {
  handleRadius: number;
  handleColor: [number, number, number, number];
};

class DragAndDropCircle extends Circle implements DragAndDroppable {
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
