import { Circle } from "./utils/circle";
import { VDU } from "./utils/vdu";
import "./style.css";
import { Square } from "./utils/square";

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

  const s1 = new Square({
    position: [50, 50],
    width: 50,
  });
  vdu.add(s1);

  function updateScene(time: number) {
    time *= 0.005;

    c1.position[0] += Math.cos(time) * 2;
    c1.position[1] += Math.sin(time / 2) * 2;

    c2.position[0] += Math.sin(time);
    c2.position[1] += Math.cos(time);

    s1.position[0] += Math.sin(time) * 5;
    s1.position[1] += Math.sin(time) * 5;
  }

  function render(time: number) {
    updateScene(time);

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
