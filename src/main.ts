import "./style.css";
import { Circle } from "./utils/circle";
import { Square } from "./utils/square";
import { VDU } from "./utils/vdu";

function main() {
  const vdu = new VDU("#gl-canvas");

  const circles: Circle[] = [];
  for (let i = 0; i < 10; i++) {
    const c = new Circle({
      position: [50 + i * 10, 50 + i * 10],
      radius: 20,
    });
    vdu.add(c);
    circles.push(c);
  }

  const squares: Square[] = [];
  for (let i = 0; i < 10; i++) {
    const s = new Square({
      position: [240, 50 + i * 10],
      width: 20,
    });
    vdu.add(s);
    squares.push(s);
  }

  function updateScene(time: number) {
    time *= 0.005;

    circles.forEach((c, i) => {
      c.position[0] += Math.sin(time + i);
      c.position[1] += Math.cos(time + i);
    });

    squares.forEach((s, i) => {
      s.position[0] += Math.cos(time + i);
    });
  }

  function render(time: number) {
    updateScene(time);

    vdu.render();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
