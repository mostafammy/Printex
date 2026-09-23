// Barrel — the only legal import surface for src/server/production/**
// (eslint.config.js module-boundary rule, specs/014-production/plan.md
// "Structure Decision"). Populated incrementally as each user story lands.

export { DomainProductionError } from "./errors";
export type { DomainProductionErrorCode } from "./errors";
export { getOperatorQueue, routeToDepartment } from "./queue";
export type { ProductionQueueRow } from "./queue";
