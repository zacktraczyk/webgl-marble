import { Circle } from "../engine/object/circle";
import { Rectangle } from "../engine/object/rectangle";
import Physics from "../engine/physics/physics";
import { VDU } from "../engine/vdu/vdu";

type ToolSelectors = {
  pan: HTMLElement | null;
  select: HTMLElement | null;
  square: HTMLElement | null;
  circle: HTMLElement | null;
};

enum SelectedTool {
  Pan,
  Select,
  Square,
  Circle,
}

let selectedTool: SelectedTool = SelectedTool.Select;

function main(toolSelectors: ToolSelectors) {
  const { vdu, physics, objects } = init(toolSelectors);

  function clearOutOfBoundsObjects() {
    const outOfBoundsPadding = 1000;

    for (const object of objects) {
      if (
        object.position[0] < -outOfBoundsPadding ||
        object.position[0] > vdu.canvas.width + outOfBoundsPadding ||
        object.position[1] < -outOfBoundsPadding ||
        object.position[1] > vdu.canvas.height + outOfBoundsPadding
      ) {
        object.delete();
        objects.splice(objects.indexOf(object), 1);
      }
    }
  }

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    physics.update(elapsed);
    for (const object of objects) {
      object.sync();
    }

    clearOutOfBoundsObjects();

    updateDebugInfo({ numObjects: objects.length });
    updateFpsPerf();
  }

  function render() {
    updateScene();

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function init({ pan, select, square, circle }: ToolSelectors) {
  const objects: (Circle | Rectangle)[] = [];
  const canvasElement = document.getElementById("gl-canvas");
  if (!canvasElement) {
    throw new Error("Canvas element not found");
  }

  const vdu = new VDU("#gl-canvas");
  const physics = new Physics();

  const addToolSelectors = () => {
    if (!pan || !select || !square || !circle) {
      throw new Error("Tool selectors not found");
    }

    pan.dataset.active = selectedTool === SelectedTool.Pan ? "true" : "false";
    select.dataset.active =
      selectedTool === SelectedTool.Select ? "true" : "false";
    square.dataset.active =
      selectedTool === SelectedTool.Square ? "true" : "false";
    circle.dataset.active =
      selectedTool === SelectedTool.Circle ? "true" : "false";

    pan.addEventListener("click", () => {
      pan.dataset.active = "true";
      select.dataset.active = "false";
      square.dataset.active = "false";
      circle.dataset.active = "false";
      selectedTool = SelectedTool.Pan;
      canvasElement.dataset.pointer = "pan";
      vdu.panAndZoom = true;
    });

    select.addEventListener("click", () => {
      pan.dataset.active = "false";
      select.dataset.active = "true";
      square.dataset.active = "false";
      circle.dataset.active = "false";
      selectedTool = SelectedTool.Select;
      canvasElement.dataset.pointer = "select";
      vdu.panAndZoom = false;
    });

    square.addEventListener("click", () => {
      pan.dataset.active = "false";
      select.dataset.active = "false";
      square.dataset.active = "true";
      circle.dataset.active = "false";
      selectedTool = SelectedTool.Square;
      canvasElement.dataset.pointer = "shape";
      vdu.panAndZoom = false;
    });

    circle.addEventListener("click", () => {
      pan.dataset.active = "false";
      select.dataset.active = "false";
      square.dataset.active = "false";
      circle.dataset.active = "true";
      selectedTool = SelectedTool.Circle;
      canvasElement.dataset.pointer = "shape";
      vdu.panAndZoom = false;
    });
  };

  addToolSelectors();

  canvasElement.addEventListener("click", (e) => {
    switch (selectedTool) {
      case SelectedTool.Pan:
        return;
      case SelectedTool.Select:
        console.log("TODO: Select");
        return;
      case SelectedTool.Square:
        {
          const screenX =
            e.clientX - canvasElement.getBoundingClientRect().left;
          const screenY = e.clientY - canvasElement.getBoundingClientRect().top;

          const [x, y] = vdu.screenToWorld(screenX, screenY);

          const square = new Rectangle({
            width: 100,
            height: 100,
            position: [x, y],
            color: [239 / 255, 68 / 255, 68 / 255, 1],
          });
          objects.push(square);
          physics.add(square);
          vdu.add(square);
        }
        return;
      case SelectedTool.Circle:
        {
          const screenX =
            e.clientX - canvasElement.getBoundingClientRect().left;
          const screenY = e.clientY - canvasElement.getBoundingClientRect().top;
          const [x, y] = vdu.screenToWorld(screenX, screenY);

          const circle = new Circle({
            radius: 50,
            position: [x, y],
            color: [34 / 255, 197 / 255, 94 / 255, 1],
          });
          objects.push(circle);
          physics.add(circle);
          vdu.add(circle);
        }
        return;
    }

    throw new Error(`Unknown tool: ${selectedTool}`);
  });

  return {
    canvasElement,
    vdu,
    physics,
    objects,
  };
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
