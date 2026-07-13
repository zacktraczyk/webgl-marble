import { Entity, type EntityId } from "./entity";
import { createTransform, type TransformInput } from "./transform";
import {
  composeTransform,
  createParentRelationship,
  type ParentRelationship,
} from "./hierarchy";

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
  private readonly _parents = new Map<EntityId, ParentRelationship>();

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

  attach(
    child: EntityId,
    parent: EntityId,
    options: {
      localTransform?: TransformInput;
      destroyWithParent?: boolean;
    } = {}
  ) {
    if (!this.has(child) || !this.has(parent)) {
      throw new Error("Cannot attach entities that are not in the world");
    }
    if (child === parent) {
      throw new Error("An entity cannot be parented to itself");
    }
    this._parents.set(child, createParentRelationship({ parent, ...options }));
  }

  detach(child: EntityId) {
    this._parents.delete(child);
  }

  updateHierarchy() {
    const resolved = new Set<EntityId>();
    const resolving = new Set<EntityId>();

    const resolve = (childId: EntityId) => {
      if (resolved.has(childId)) {
        return;
      }
      if (resolving.has(childId)) {
        throw new Error("Entity hierarchy contains a cycle");
      }
      const relationship = this._parents.get(childId);
      if (!relationship) {
        resolved.add(childId);
        return;
      }

      resolving.add(childId);
      resolve(relationship.parent);
      const child = this.get(childId);
      const parent = this.get(relationship.parent);
      if (child && parent) {
        composeTransform(
          child.transform,
          parent.transform,
          relationship.localTransform
        );
      }
      resolving.delete(childId);
      resolved.add(childId);
    };

    for (const child of this._parents.keys()) {
      resolve(child);
    }
  }

  flushDestruction() {
    for (const id of this._pendingDestruction) {
      const entity = this._entities.get(id);
      if (!entity) {
        continue;
      }
      for (const [childId, relationship] of [...this._parents]) {
        if (relationship.parent === id && relationship.destroyWithParent) {
          this.destroy(childId);
        } else if (relationship.parent === id) {
          this._parents.delete(childId);
        }
      }
      for (const listener of this._destructionListeners) {
        listener(entity);
      }
      this._entities.delete(id);
      this._parents.delete(id);
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

  get parents(): ReadonlyMap<EntityId, ParentRelationship> {
    return this._parents;
  }
}
