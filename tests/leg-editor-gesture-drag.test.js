import { describe, expect, test } from "bun:test";
import { createGridLayout } from "../src/game/level/grid.ts";
import { DRAG_THRESHOLD } from "../src/editor/legEditor/constants.ts";
import {
  updateMarqueeDrag,
  updateMoveDrag,
  updatePlaceDrag,
  updateWallDrag,
} from "../src/editor/legEditor/gestureDrag.ts";

const bounds = { min: [-705, -390], max: [705, 270] };
const gridLayout = createGridLayout(bounds);

const wall = (overrides = {}) => ({
  id: "wall",
  prefab: "wall",
  properties: {
    start: [-50, 0],
    end: [50, 0],
    thickness: 40,
    color: [1, 1, 1, 1],
  },
  ...overrides,
});

const finishZone = (overrides = {}) => ({
  id: "finish",
  prefab: "finish-zone",
  transform: { position: [0, 0], rotation: 0 },
  properties: { width: 100, height: 40, color: [1, 1, 1, 1] },
  ...overrides,
});

describe("leg editor gesture drag", () => {
  test("updatePlaceDrag always returns handled", () => {
    expect(updatePlaceDrag()).toBe("handled");
  });

  test("updateMoveDrag stays pending below the drag threshold", () => {
    const object = finishZone();
    const gesture = {
      kind: "move",
      startScreen: [0, 0],
      startWorld: [0, 0],
      changed: false,
      originals: new Map([[object.id, structuredClone(object)]]),
    };
    const onObjectsChange = () => {
      throw new Error("should not move before threshold");
    };
    const deps = {
      screenDistance: (first, second) =>
        Math.hypot(first[0] - second[0], first[1] - second[1]),
      getDefaultWallThickness: () => 25,
      getGridSnapEnabled: () => false,
      getGridLayout: () => gridLayout,
      getObjects: () => [object],
      findObject: (id) => (id === object.id ? object : null),
      onObjectsChange,
    };

    expect(
      updateMoveDrag(
        gesture,
        [DRAG_THRESHOLD - 1, 0],
        [10, 0],
        { shiftKey: false, altKey: false },
        deps
      )
    ).toBe("pending");
    expect(gesture.changed).toBe(false);
    expect(object.transform.position).toEqual([0, 0]);
  });

  test("updateMoveDrag moves objects and notifies once past the threshold", () => {
    const object = finishZone();
    const original = structuredClone(object);
    const gesture = {
      kind: "move",
      startScreen: [0, 0],
      startWorld: [0, 0],
      changed: false,
      originals: new Map([[object.id, original]]),
    };
    const changed = [];
    const deps = {
      screenDistance: (first, second) =>
        Math.hypot(first[0] - second[0], first[1] - second[1]),
      getDefaultWallThickness: () => 25,
      getGridSnapEnabled: () => false,
      getGridLayout: () => gridLayout,
      getObjects: () => [object],
      findObject: (id) => (id === object.id ? object : null),
      onObjectsChange: (objects) => changed.push(objects),
    };

    expect(
      updateMoveDrag(
        gesture,
        [DRAG_THRESHOLD, 0],
        [30, 20],
        { shiftKey: false, altKey: false },
        deps
      )
    ).toBe("handled");
    expect(gesture.changed).toBe(true);
    expect(object.transform.position).toEqual([30, 20]);
    expect(changed).toEqual([[object]]);
  });

  test("updateWallDrag snaps the end point and marks changed after threshold", () => {
    const endpointTarget = {
      objectId: "other-wall",
      endpoint: "start",
      position: [120, 40],
      object: wall({ id: "other-wall" }),
    };
    const feedback = { target: "unset", kind: "unset" };
    const gesture = {
      kind: "wall",
      start: [0, 0],
      end: [0, 0],
      startScreen: [0, 0],
      changed: false,
    };
    const deps = {
      screenDistance: (first, second) =>
        Math.hypot(first[0] - second[0], first[1] - second[1]),
      snapDeps: {
        worldToScreen: (point) => point,
        getGridSnapEnabled: () => false,
        getGridLayout: () => gridLayout,
        findWallEndpointTarget: () => endpointTarget,
        setEndpointFeedback: (target, kind) => {
          feedback.target = target;
          feedback.kind = kind;
        },
      },
    };

    expect(
      updateWallDrag(
        gesture,
        [0, 0],
        [118, 39],
        { shiftKey: false, altKey: false },
        deps
      )
    ).toBe("handled");
    expect(gesture.end).toEqual([120, 40]);
    expect(gesture.changed).toBe(false);
    expect(feedback.target).toBe(endpointTarget);

    updateWallDrag(
      gesture,
      [DRAG_THRESHOLD, 0],
      [118, 39],
      { shiftKey: false, altKey: false },
      deps
    );
    expect(gesture.changed).toBe(true);
  });

  test("updateMarqueeDrag replaces selection once the drag crosses threshold", () => {
    const inside = finishZone({ id: "inside" });
    const outside = finishZone({
      id: "outside",
      transform: { position: [500, 500], rotation: 0 },
    });
    const selected = [];
    const gesture = {
      kind: "marquee",
      startScreen: [0, 0],
      startWorld: [-10, -10],
      currentWorld: [-10, -10],
      changed: false,
      additive: false,
      initialSelection: [],
    };
    const selection = {
      replaceAll: (ids) => selected.push([...ids]),
    };
    const deps = {
      screenDistance: (first, second) =>
        Math.hypot(first[0] - second[0], first[1] - second[1]),
      getDefaultWallThickness: () => 25,
      getGridSnapEnabled: () => false,
      getGridLayout: () => gridLayout,
      getObjects: () => [inside, outside],
      findObject: () => null,
      onObjectsChange: () => {},
      selection,
    };

    updateMarqueeDrag(gesture, [0, 0], [-10, -10], deps);
    expect(selected).toHaveLength(0);

    updateMarqueeDrag(gesture, [DRAG_THRESHOLD, 0], [120, 80], deps);
    expect(gesture.changed).toBe(true);
    expect(selected).toEqual([["inside"]]);
  });
});
