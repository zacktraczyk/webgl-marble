import Stage from "../engine/stage";
import { LevelDocument } from "../editor/levelDocument";
import { levelObjectDefinition } from "../game/prefabs/levelObject";

type ToolSelectors = {
  pan: HTMLElement | null;
  select: HTMLElement | null;
  square: HTMLElement | null;
  circle: HTMLElement | null;
  finishLine: HTMLElement | null;
};

enum SelectedTool {
  Pan,
  Select,
  Square,
  Circle,
  FinishLine,
}

let selectedTool: SelectedTool = SelectedTool.Select;

function main(toolSelectors: ToolSelectors) {
  const { stage, levelDocument } = init(toolSelectors);

  const finishedBalls: number[] = [];
  stage.registerPhysicsObserver(({ entityCollisions }) => {
    for (const { entity1: a, entity2: b } of entityCollisions) {
      const collisionPermutations = [
        [a, b],
        [b, a],
      ];
      for (const [marbleId, finishId] of collisionPermutations) {
        const marble = stage.world.get(marbleId);
        const finish = stage.world.get(finishId);
        if (marble?.hasTag("marble") && finish?.hasTag("finish-zone")) {
          marble.delete();
          finishedBalls.push(marble.id);
          break;
        }
      }
    }
  });

  let lastTime = performance.now();
  function updateScene() {
    const time = performance.now();
    const elapsed = time - lastTime;
    lastTime = time;

    stage.update(elapsed);
    stage.clearOutOfBoundsObjects();

    updateDebugInfo({
      numObjects: stage.objects.length + stage.entities.length,
      authoredObjects: levelDocument.objects.length,
      finishedBalls,
    });
    updateFpsPerf();
  }

  function render() {
    updateScene();

    stage.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function init({ pan, select, square, circle, finishLine }: ToolSelectors) {
  const stage = new Stage();
  const levelDocument = new LevelDocument("Untitled level", [
    stage.width,
    stage.height,
  ]);
  const spawnAuthoredObject = (data: Parameters<LevelDocument["add"]>[0]) => {
    const levelObject = levelDocument.add(data);
    return stage.spawn(levelObjectDefinition(levelObject));
  };

  const addToolSelectors = () => {
    if (!pan || !select || !square || !circle || !finishLine) {
      throw new Error("Tool selectors not found");
    }

    pan.dataset.active = selectedTool === SelectedTool.Pan ? "true" : "false";
    select.dataset.active =
      selectedTool === SelectedTool.Select ? "true" : "false";
    square.dataset.active =
      selectedTool === SelectedTool.Square ? "true" : "false";
    circle.dataset.active =
      selectedTool === SelectedTool.Circle ? "true" : "false";

    const deselectAll = () => {
      pan.dataset.active = "false";
      select.dataset.active = "false";
      square.dataset.active = "false";
      circle.dataset.active = "false";
      finishLine.dataset.active = "false";
    };

    pan.addEventListener("click", () => {
      deselectAll();
      pan.dataset.active = "true";
      selectedTool = SelectedTool.Pan;
      stage.canvas.dataset.pointer = "pan";
      stage.panAndZoom = true;
    });

    select.addEventListener("click", () => {
      deselectAll();
      select.dataset.active = "true";
      selectedTool = SelectedTool.Select;
      stage.canvas.dataset.pointer = "select";
      stage.panAndZoom = false;
    });

    square.addEventListener("click", () => {
      deselectAll();
      square.dataset.active = "true";
      selectedTool = SelectedTool.Square;
      stage.canvas.dataset.pointer = "shape";
      stage.panAndZoom = false;
    });

    circle.addEventListener("click", () => {
      deselectAll();
      circle.dataset.active = "true";
      selectedTool = SelectedTool.Circle;
      stage.canvas.dataset.pointer = "shape";
      stage.panAndZoom = false;
    });

    finishLine.addEventListener("click", () => {
      deselectAll();
      finishLine.dataset.active = "true";
      selectedTool = SelectedTool.FinishLine;
      stage.canvas.dataset.pointer = "shape";
      stage.panAndZoom = false;
    });
  };

  addToolSelectors();

  stage.canvas.addEventListener("click", (e) => {
    switch (selectedTool) {
      case SelectedTool.Pan:
        return;
      case SelectedTool.Select:
        console.log("TODO: Select");
        return;
      case SelectedTool.Square:
        {
          const screenX = e.clientX - stage.canvas.getBoundingClientRect().left;
          const screenY = e.clientY - stage.canvas.getBoundingClientRect().top;

          const [x, y] = stage.screenToWorld(screenX, screenY);

          spawnAuthoredObject({
            prefab: "wall",
            transform: { position: [x, y] },
            properties: {
              width: 100,
              height: 100,
              color: [239 / 255, 68 / 255, 68 / 255, 1],
            },
          });
        }
        return;
      case SelectedTool.Circle:
        {
          const screenX = e.clientX - stage.canvas.getBoundingClientRect().left;
          const screenY = e.clientY - stage.canvas.getBoundingClientRect().top;
          const [x, y] = stage.screenToWorld(screenX, screenY);

          spawnAuthoredObject({
            prefab: "marble",
            transform: { position: [x, y] },
            properties: {
              radius: 50,
              color: [34 / 255, 197 / 255, 94 / 255, 1],
            },
          });
        }
        return;
      case SelectedTool.FinishLine:
        {
          const screenX = e.clientX - stage.canvas.getBoundingClientRect().left;
          const screenY = e.clientY - stage.canvas.getBoundingClientRect().top;
          const [x, y] = stage.screenToWorld(screenX, screenY);

          spawnAuthoredObject({
            prefab: "finish-zone",
            transform: { position: [x, y] },
            properties: {
              width: 200,
              height: 10,
              color: [1, 1, 1, 1],
            },
          });
        }
        return;
    }

    throw new Error(`Unknown tool: ${selectedTool}`);
  });

  return {
    stage,
    levelDocument,
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
