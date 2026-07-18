/**
 * Process-wide monotonic ids shared by core entities, physics bodies, and
 * draw entities. Equality across subsystems is not guaranteed — link via the
 * owning entity's id (`ownerId`) when you need a cross-layer reference.
 */
let CURRENT_ID = 0;

export const getNext = () => {
  return CURRENT_ID++;
};
