import type { PhysicsComponentDefinition } from "../physics/component";
import type { RenderComponentDefinition } from "../vdu/component";
import type { EntityCoreDefinition } from "./world";

export interface EntityDefinition extends EntityCoreDefinition {
  physics?: PhysicsComponentDefinition;
  render?: RenderComponentDefinition;
}
