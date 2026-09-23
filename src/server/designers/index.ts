// Barrel — the ONLY legal import surface from outside src/server/designers/**
// (specs/012-designer-assignment-timers/plan.md "Structure Decision").
// Populated incrementally as each Setup/Foundational/User Story task lands.

export { DomainDesignerError } from "./errors";
export { suggestDesigner } from "./suggestion";
export type { DesignerLoadCandidate } from "./suggestion";

// US1 / US2 — src/server/designers/assignment.ts
export { getEligibleDesigners, assignDesigner, WorkItemTransitionError } from "./assignment";
export type { EligibleDesigner } from "./assignment";

// US3 — src/server/designers/queue.ts, src/server/designers/timer.ts
// (contracts/designer-assignment.md).
export { getMyQueue } from "./queue";
export type { MyQueueRow, MyQueueRowState } from "./queue";
export { startTimer, pauseTimer, phaseDurations } from "./timer";
export type { PhaseDurations } from "./timer";

// US4
export { uploadDesignVersion, markDesignComplete, WorkItemDesignTransitionError } from "./designVersions";
export type { UploadDesignVersionFile } from "./designVersions";
