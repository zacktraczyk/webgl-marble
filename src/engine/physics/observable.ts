export const PHYSICS_EVENTS = ["collisions"] as const;

export type PhysicsEvents = typeof PHYSICS_EVENTS;
export type PhysicsEventName = (typeof PHYSICS_EVENTS)[number];
