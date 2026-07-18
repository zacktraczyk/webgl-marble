import type { LevelObjectData } from "../../game/level/document";

/** Owns selection and hover identity independently from gesture handling. */
export class LegEditorSelection {
  private readonly ids = new Set<string>();
  private hoveredId: string | null = null;

  constructor(private readonly getObjects: () => readonly LevelObjectData[]) {}

  get size() {
    return this.ids.size;
  }

  has(id: string) {
    return this.ids.has(id);
  }

  add(id: string) {
    this.ids.add(id);
  }

  delete(id: string) {
    this.ids.delete(id);
  }

  replace(id: string) {
    this.ids.clear();
    this.ids.add(id);
  }

  replaceAll(ids: Iterable<string>) {
    this.ids.clear();
    for (const id of ids) {
      this.ids.add(id);
    }
  }

  clear() {
    this.ids.clear();
  }

  snapshot() {
    return new Set(this.ids);
  }

  setHovered(id: string | null) {
    this.hoveredId = id;
  }

  clearAll() {
    this.ids.clear();
    this.hoveredId = null;
  }

  get selectedObjects() {
    return this.getObjects().filter(
      (object) => !object.locked && this.ids.has(object.id)
    );
  }

  get selectedObject() {
    const selected = this.selectedObjects;
    return selected.length === 1 ? selected[0] : null;
  }

  get hoveredObject() {
    if (!this.hoveredId) {
      return null;
    }
    return (
      this.getObjects().find((object) => object.id === this.hoveredId) ?? null
    );
  }
}
