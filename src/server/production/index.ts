// Barrel — the only legal import surface for src/server/production/**
// (eslint.config.js module-boundary rule, specs/014-production/plan.md
// "Structure Decision"). Populated incrementally as each user story lands.

export { DomainProductionError } from "./errors";
export type { DomainProductionErrorCode } from "./errors";
export { getOperatorQueue, routeToDepartment } from "./queue";
export type { ProductionQueueRow } from "./queue";
export { getJobCard } from "./jobCard";
export type { JobCard, JobCardSpec, JobCardApprovedFile } from "./jobCard";
export { startProduction, pauseProduction, resumeProduction, acknowledgeFileRevision } from "./timer";
export { completeProduction } from "./completion";
export type { CompleteProductionInput } from "./completion";
export { sendBackToDesign } from "./sendBack";
export type { SendBackToDesignInput } from "./sendBack";
export { recordSentToVendor, recordReceivedFromVendor } from "./vendor";
