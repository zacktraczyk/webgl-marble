import { Entity, type EntityId } from "./entity";
import { createTransform, type TransformInput } from "./transform";

export interface EntityCoreDefinition {
  transform: TransformInput;
  tags?: string[];
}

type DestructionListener = (entity: Entity) => void;

/** Owns entity identity and lifecycle. Subsystems subscribe only to teardown. */
export class World {
  private readonly _entities = new Map<EntityId, Entity>();
  private readonly _pendingDestruction = new Set<EntityId>();
  private readonly _destructionListeners = new Set<DestructionListener>();

  create(definition: EntityCoreDefinition): Entity {
    const entity = new Entity({
      transform: createTransform(definition.transform),
      tags: definition.tags,
      destroy: (id) => this.destroy(id),
    });
    this._entities.set(entity.id, entity);
    return entity;
  }

  get(id: EntityId) {
    return this._entities.get(id);
  }

  has(id: EntityId) {
    return this._entities.has(id);
  }

  destroy(id: EntityId) {
    const entity = this._entities.get(id);
    if (!entity || entity.markedForDeletion) {
      return;
    }
    entity.markedForDeletion = true;
    this._pendingDestruction.add(id);
  }

  flushDestruction() {
    for (const id of this._pendingDestruction) {
      const entity = this._entities.get(id);
      if (!entity) {
        continue;
      }
      for (const listener of this._destructionListeners) {
        listener(entity);
      }
      this._entities.delete(id);
    }
    this._pendingDestruction.clear();
  }

  onDestroy(listener: DestructionListener) {
    this._destructionListeners.add(listener);
    return () => this._destructionListeners.delete(listener);
  }

  get entities() {
    return [...this._entities.values()];
  }
}
