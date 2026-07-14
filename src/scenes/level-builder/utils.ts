import type { Vec2 } from "../../engine/core/transform";
import { GRID_SIZE } from "./constants";

export const requireElement = <T extends HTMLElement>(
  element: HTMLElement | null,
  label: string
) => {
  if (!element) {
    throw new Error(`Level builder element not found: ${label}`);
  }
  return element as T;
};

export const clampInteger = (value: string, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10) || minimum));

export const snapToGrid = ([x, y]: Vec2): Vec2 => [
  Math.round(x / GRID_SIZE) * GRID_SIZE,
  Math.round(y / GRID_SIZE) * GRID_SIZE,
];

export const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const createSeededRandom = (initialSeed: number) => {
  let seed = initialSeed;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
};
