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

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    physics.update(elapsed);
    for (const object of objects) {
      object.sync();
    }
  }

  function render() {
    updateScene();

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function init({ pan, select, square, circle }: ToolSelectors) {
  const objects: { sync: () => void }[] = [];
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
    });

    select.addEventListener("click", () => {
      pan.dataset.active = "false";
      select.dataset.active = "true";
      square.dataset.active = "false";
      circle.dataset.active = "false";
      selectedTool = SelectedTool.Select;
      canvasElement.dataset.pointer = "select";
    });

    square.addEventListener("click", () => {
      pan.dataset.active = "false";
      select.dataset.active = "false";
      square.dataset.active = "true";
      circle.dataset.active = "false";
      selectedTool = SelectedTool.Square;
      canvasElement.dataset.pointer = "shape";
    });

    circle.addEventListener("click", () => {
      pan.dataset.active = "false";
      select.dataset.active = "false";
      square.dataset.active = "false";
      circle.dataset.active = "true";
      selectedTool = SelectedTool.Circle;
      canvasElement.dataset.pointer = "shape";
    });
  };

  addToolSelectors();

  canvasElement.addEventListener("click", (e) => {
    switch (selectedTool) {
      case SelectedTool.Pan:
        console.log("TODO: Pan");
        break;
      case SelectedTool.Select:
        console.log("TODO: Select");
        break;
      case SelectedTool.Square:
        {
          const x = e.clientX - canvasElement.getBoundingClientRect().left;
          const y = e.clientY - canvasElement.getBoundingClientRect().top;

          const square = new Rectangle({
            width: 100,
            height: 100,
            position: [x, y],
            color: [1, 0, 0, 1],
          });
          objects.push(square);
          physics.add(square);
          vdu.add(square);
        }
        break;
      case SelectedTool.Circle:
        {
          const x = e.clientX - canvasElement.getBoundingClientRect().left;
          const y = e.clientY - canvasElement.getBoundingClientRect().top;

          const circle = new Circle({
            radius: 50,
            position: [x, y],
            color: [0, 1, 0, 1],
          });
          objects.push(circle);
          physics.add(circle);
          vdu.add(circle);
        }
        break;
    }
  });

  return {
    canvasElement,
    vdu,
    physics,
    objects,
  };
}

export default main;
