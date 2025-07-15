import Stage from "../engine/stage";
import {
  createCircle,
  createRectangle,
  type DrawEntity,
} from "../engine/vdu/entity";
import type { Drawable } from "../engine/vdu/entity";
import {
  type Physical,
  PhysicsEntity,
  type PhysicsEntityType,
} from "../engine/physics/entity";
import { getNext } from "../engine/utils/id";

function main() {
  const stage = new Stage();
  stage.panAndZoom = true;

  const spawnX = -250;
  const spawnY = -stage.canvas.clientHeight / 2 + 100;

  const circle1 = new Circle({
    position: [spawnX, spawnY],
    radius: 40,
    color: [1, 0, 0, 1],
    physicsType: "dynamic",
  });
  stage.add(circle1);

  const square1 = new Rectangle({
    position: [spawnX - 40, 0],
    width: 100,
    height: 100,
    rotation: Math.PI / 8,
    physicsType: "kinematic",
    color: [0, 1, 0, 1],
  });
  stage.add(square1);

  const collisions: [number, number][] = [];
  stage.registerPhysicsObserver(({ collisions: newCollisions }) => {
    for (const collision of newCollisions) {
      const { entity1, entity2 } = collision;
      const alreadyCollided = collisions.some(
        (c) =>
          c[0] === entity1.parent.physicsEntity.id &&
          c[1] === entity2.parent.physicsEntity.id
      );
      if (alreadyCollided) {
        continue;
      }

      collisions.push([
        entity1.parent.physicsEntity.id,
        entity2.parent.physicsEntity.id,
      ]);
    }
  });

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    if (circle1.position[1] > stage.canvas.clientHeight + 100) {
      circle1.velocity[0] = 0;
      circle1.velocity[1] = 0;
      circle1.position[0] = spawnX;
      circle1.position[1] = spawnY;
    }

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

class Rectangle implements Drawable, Physical {
  readonly id;
  readonly width: number;
  readonly height: number;
  rotation: number;
  scale: [number, number];
  color: [number, number, number, number];
  private _position: [number, number];
  velocity: [number, number];
  markedForDeletion: boolean = false;

  private _physicsType: PhysicsEntityType;
  private _rectangleDrawEntity: DrawEntity | null = null;

  private _physicsEntity: PhysicsEntity | null = null;

  constructor({
    width,
    height,
    position,
    rotation,
    scale,
    color,
    physicsType,
    velocity,
  }: {
    width: number;
    height: number;
    position: [number, number];
    rotation: number;
    scale?: [number, number];
    color?: [number, number, number, number];
    physicsType?: PhysicsEntityType;
    velocity?: [number, number];
  }) {
    this.id = getNext();
    this.width = width;
    this.height = height;
    this.rotation = rotation;
    this.scale = scale ?? [1, 1];
    this.color = color ?? [1, 1, 1, 1];
    this._position = position;
    this._physicsType = physicsType ?? "dynamic";
    this.velocity = velocity ?? [0, 0];
  }

  get position() {
    return this._position;
  }

  set position(value: [number, number]) {
    if (this._physicsEntity) {
      this._physicsEntity.position = value;
    }
    this._position = value;
  }

  get physicsEntity(): PhysicsEntity {
    if (!this._physicsEntity) {
      this._physicsEntity = new PhysicsEntity({
        parent: this,
        type: this._physicsType,
        position: this._position,
        rotation: this.rotation,
        boundingShape: {
          type: "BoundingConvexPolygon",
          position: this._position,
          vertices: [
            [-this.width / 2, -this.height / 2],
            [this.width / 2, -this.height / 2],
            [this.width / 2, this.height / 2],
            [-this.width / 2, this.height / 2],
          ],
        },
        velocity: this.velocity,
      });
    }

    return this._physicsEntity;
  }

  get drawEntities() {
    if (!this._rectangleDrawEntity) {
      const entity = createRectangle({
        parent: this,
        width: this.width,
        height: this.height,
      });
      this._rectangleDrawEntity = entity;
    }

    return [this._rectangleDrawEntity];
  }

  delete() {
    if (this._rectangleDrawEntity) {
      this._rectangleDrawEntity.delete();
    }
  }

  sync() {
    if (this._physicsEntity) {
      this.position = this._physicsEntity.position;
      this.rotation = this._physicsEntity.rotation;
      this.velocity = this._physicsEntity.velocity;
    }

    if (this._rectangleDrawEntity) {
      this._rectangleDrawEntity.position = this.position;
      this._rectangleDrawEntity.rotation = this.rotation;
      this._rectangleDrawEntity.scale = this.scale;
      this._rectangleDrawEntity.color = this.color;
    }
  }
}

class Circle implements Drawable, Physical {
  readonly id;
  readonly radius: number;
  scale: [number, number];
  color: [number, number, number, number];
  private _position: [number, number];
  velocity: [number, number];

  private _circleDrawEntity: DrawEntity | null = null;

  private _physicsType: PhysicsEntityType;
  private _physicsEntity: PhysicsEntity | null = null;

  markedForDeletion: boolean = false;

  constructor({
    radius,
    position,
    scale,
    color,
    physicsType,
    velocity,
  }: {
    radius: number;
    position: [number, number];
    scale?: [number, number];
    color?: [number, number, number, number];
    physicsType?: PhysicsEntityType;
    velocity?: [number, number];
  }) {
    this.id = getNext();
    this.radius = radius;
    this._position = position;
    this.scale = scale ?? [1, 1];
    this.color = color ?? [1, 1, 1, 1];
    this._physicsType = physicsType ?? "dynamic";
    this.velocity = velocity ?? [0, 0];
  }

  get position() {
    return this._position;
  }

  set position(value: [number, number]) {
    if (this._physicsEntity) {
      this._physicsEntity.position = value;
    }
    this._position = value;
  }

  get physicsEntity(): PhysicsEntity {
    if (!this._physicsEntity) {
      this._physicsEntity = new PhysicsEntity({
        parent: this,
        type: this._physicsType,
        position: this._position,
        boundingShape: {
          type: "BoundingCircle",
          position: this._position,
          radius: this.radius,
        },
        velocity: this.velocity,
      });
    }

    return this._physicsEntity;
  }

  get drawEntities() {
    if (!this._circleDrawEntity) {
      const entity = createCircle(this, this.radius);
      this._circleDrawEntity = entity;
    }

    return [this._circleDrawEntity];
  }

  delete() {
    if (this._circleDrawEntity) {
      this._circleDrawEntity.delete();
    }
  }

  sync() {
    if (this._physicsEntity) {
      this.position = this._physicsEntity.position;
      this.velocity = this._physicsEntity.velocity;
    }

    if (this._circleDrawEntity) {
      this._circleDrawEntity.position = this.position;
      this._circleDrawEntity.scale = this.scale;
      this._circleDrawEntity.color = this.color;
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
