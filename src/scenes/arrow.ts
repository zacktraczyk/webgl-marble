import { Arrow } from "../engine/object/arrow";
import { Rectangle } from "../engine/object/rectangle";
import Stage from "../engine/stage";
import type { Scene } from "../engine/runtime/scene";

function createScene(): Scene {
  const stage = new Stage();

  const pinWheelCenter: [number, number] = [0, 0];
  const arrowLength = 150;
  const arrowParams: Partial<ConstructorParameters<typeof Arrow>[0]> = {
    tipLength: 40,
    stroke: 4,
    color: [0.8, 0.4, 0.6, 1],
  };
  const offset = 50;

  const constructArrows = () => {
    const arrows: [number, number, number, number][] = [];
    // diamond shape
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const baseX =
          pinWheelCenter[0] +
          offset * (i % 2 ? 1 : -1) +
          offset * (j % 2 ? 1 : -1);
        const baseY =
          pinWheelCenter[1] +
          offset * (j % 2 ? 1 : -1) +
          offset * (i % 2 ? -1 : 1);

        const tipX =
          baseX +
          (arrowLength * (i % 2 ? 1 : -1) + arrowLength * (j % 2 ? 1 : -1)) / 2;
        const tipY =
          baseY +
          (arrowLength * (j % 2 ? 1 : -1) + arrowLength * (i % 2 ? -1 : 1)) / 2;

        arrows.push([baseX, baseY, tipX, tipY]);
      }
    }

    // random angle
    arrows.push([-50, -100, 100, 230]);

    for (const [baseX, baseY, tipX, tipY] of arrows) {
      const baseRect = new Rectangle({
        width: 40,
        height: 40,
        position: [baseX, baseY],
        color: [0.3, 0, 0, 1],
      });
      stage.add(baseRect);

      const tipRect = new Rectangle({
        width: 40,
        height: 40,
        position: [tipX, tipY],
        color: [0, 0.3, 0, 1],
      });
      stage.add(tipRect);

      const arrow = new Arrow({
        basePosition: [baseX, baseY],
        tipPosition: [tipX, tipY],
        ...arrowParams,
      });
      stage.add(arrow);
    }
  };
  constructArrows();

  const rotatingArrowCenter: [number, number] = [-300, -300];
  const baseSquareRotating = new Rectangle({
    width: 40,
    height: 40,
    position: rotatingArrowCenter,
    color: [0.3, 0, 0, 1],
  });
  stage.add(baseSquareRotating);

  const tipSquareRotating = new Rectangle({
    width: 40,
    height: 40,
    position: [rotatingArrowCenter[0], rotatingArrowCenter[1] + arrowLength],
    color: [0, 0.3, 0, 1],
  });
  stage.add(tipSquareRotating);

  const rotatingArrow = new Arrow({
    basePosition: rotatingArrowCenter,
    tipPosition: [rotatingArrowCenter[0], rotatingArrowCenter[1] + arrowLength],
    ...arrowParams,
  });
  stage.add(rotatingArrow);

  let simulationTime = 0;
  return {
    fixedUpdate: (deltaMs) => {
      simulationTime += deltaMs;
      const arrowTip: [number, number] = [
        rotatingArrowCenter[0] + Math.cos(simulationTime / 1000) * arrowLength,
        rotatingArrowCenter[1] + Math.sin(simulationTime / 1000) * arrowLength,
      ];
      rotatingArrow.tipPosition = arrowTip;
      tipSquareRotating.position = arrowTip;
      stage.update(deltaMs);
    },
    update: () => {
      updateDebugInfo({});
    },
    render: () => stage.render(),
    dispose: () => stage.dispose(),
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

export default createScene;
