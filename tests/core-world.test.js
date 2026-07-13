import { describe, expect, test } from "bun:test";
import { createTransform } from "../src/engine/core/transform";
import { World } from "../src/engine/core/world";
import { marbleDefinition } from "../src/game/prefabs/marble";

describe("core world", () => {
  test("owns one transform per entity without aliasing caller arrays", () => {
    const sourcePosition = [10, 20];
    const transform = createTransform({ position: sourcePosition });

    sourcePosition[0] = 99;

    expect(transform.position).toEqual([10, 20]);
  });

  test("updates child world transforms from local offsets", () => {
    const world = new World();
    const parent = world.create({
      transform: { position: [10, 20], rotation: Math.PI / 2 },
    });
    const child = world.create({ transform: { position: [0, 0] } });

    world.attach(child.id, parent.id, {
      localTransform: { position: [5, 0] },
    });
    world.updateHierarchy();

    expect(child.position[0]).toBeCloseTo(10);
    expect(child.position[1]).toBeCloseTo(25);
    expect(child.rotation).toBeCloseTo(Math.PI / 2);
  });

  test("destroys owned descendants in the same lifecycle flush", () => {
    const world = new World();
    const parent = world.create({ transform: { position: [0, 0] } });
    const child = world.create({ transform: { position: [0, 0] } });
    world.attach(child.id, parent.id);

    parent.delete();
    parent.delete();
    world.flushDestruction();

    expect(world.has(parent.id)).toBe(false);
    expect(world.has(child.id)).toBe(false);
  });
});

describe("prefabs", () => {
  test("builds a decorated marble as one entity with local render parts", () => {
    const definition = marbleDefinition({
      position: [30, 40],
      radius: 12,
      color: [0, 0, 1, 1],
    });

    expect(definition.tags).toContain("marble");
    expect(definition.physics?.collider.type).toBe("circle");
    expect(definition.render?.parts).toHaveLength(2);
    const highlightPosition =
      definition.render?.parts[1].localTransform?.position;
    expect(highlightPosition?.[0]).toBeCloseTo(-3.36);
    expect(highlightPosition?.[1]).toBeCloseTo(-3.6);
  });
});
