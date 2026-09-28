/**
 * Register default WAAPI choreographies into ChoreographyRegistry.
 * (plan.md S1, S2-O)
 */

import type { ChoreographyRegistry } from "./ChoreographyRegistry";
import { FlyBackChoreography } from "./choreographies/FlyBack";
import { InstantChoreography } from "./choreographies/Instant";
import { LandChoreography } from "./choreographies/Land";
import { LiftChoreography } from "./choreographies/Lift";
import { ReworkArcChoreography } from "./choreographies/ReworkArc";
import { RollOutChoreography } from "./choreographies/RollOut";
import { StampChoreography } from "./choreographies/Stamp";
import { TravelChoreography } from "./choreographies/Travel";

export function registerDefaultChoreographies(
  registry: ChoreographyRegistry,
): ChoreographyRegistry {
  registry.register("lift", new LiftChoreography());
  registry.register("travel", new TravelChoreography());
  registry.register("stamp", new StampChoreography());
  registry.register("fly-back", new FlyBackChoreography());
  registry.register("rework-arc", new ReworkArcChoreography());
  registry.register("instant", new InstantChoreography());
  registry.register("roll-out", new RollOutChoreography());
  registry.register("land", new LandChoreography());
  return registry;
}
