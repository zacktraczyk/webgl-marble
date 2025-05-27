import Physics from "../engine/physics/physics";
import { VDU } from "../engine/vdu/vdu";

function main() {
  const { vdu, physics, objects } = init();

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

function init() {
  const objects: { sync: () => void }[] = [];
  // const stage = new Stage({
  //   width: 1000,
  //   height: 1000,
  // });
  const vdu = new VDU("#gl-canvas");
  const physics = new Physics();

  return {
    vdu,
    physics,
    objects,
  };
}

export default main;
