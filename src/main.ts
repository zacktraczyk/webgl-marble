import { Circle } from "./utils/circle";
import { VDU } from "./utils/vdu";
import "./style.css";

function main() {
  const vdu = new VDU("#gl-canvas");

  const c1 = new Circle({
    position: [100, 100],
    radius: 50,
  });
  vdu.add(c1);

  const c2 = new Circle({
    position: [150, 150],
    radius: 50,
  });
  vdu.add(c2);

  function updateScene(time: number) {
    time *= 0.005;

    c1.position[0] += Math.cos(time) * 2;
    c1.position[1] += Math.sin(time / 2) * 2;

    c2.position[0] += Math.sin(time / 1);
    c2.position[1] += Math.cos(time / 1);
  }

  function render(time: number) {
    updateScene(time);

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
