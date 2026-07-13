import { getNext } from "../utils/id";
import type { Transform } from "./transform";

export type EntityId = number;

/**
 * The only globally meaningful entity in the engine. Physics bodies and render
 * parts use this id as their owner rather than pointing back to game objects.
 */
export class Entity {
  readonly id: EntityId;
  readonly transform: Transform;
  readonly tags: Set<string>;
  markedForDeletion = false;

  private readonly _destroy: (id: EntityId) => void;

  constructor({
    transform,
    tags = [],
    destroy,
  }: {
    transform: Transform;
    tags?: Iterable<string>;
    destroy: (id: EntityId) => void;
  }) {
    this.id = getNext();
    this.transform = transform;
    this.tags = new Set(tags);
    this._destroy = destroy;
  }

  get position() {
    return this.transform.position;
  }

  set position(position: [number, number]) {
    this.transform.position[0] = position[0];
    this.transform.position[1] = position[1];
  }

  get rotation() {
    return this.transform.rotation;
  }

  set rotation(rotation: number) {
    this.transform.rotation = rotation;
  }

  get scale() {
    return this.transform.scale;
  }

  set scale(scale: [number, number]) {
    this.transform.scale[0] = scale[0];
    this.transform.scale[1] = scale[1];
  }

  hasTag(tag: string) {
    return this.tags.has(tag);
  }

  delete() {
    this._destroy(this.id);
  }
}
