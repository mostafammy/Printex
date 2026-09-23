// Barrel — the ONLY legal import surface from outside src/server/designers/**
// (specs/012-designer-assignment-timers/plan.md "Structure Decision").
// Populated incrementally as each Setup/Foundational/User Story task lands.

export { DomainDesignerError } from "./errors";
export { suggestDesigner } from "./suggestion";
export type { DesignerLoadCandidate } from "./suggestion";
