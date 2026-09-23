// Barrel — the ONLY legal import surface from outside src/server/review/**
// (specs/013-review-rework/plan.md "Structure Decision").
// Populated incrementally as each Foundational/User Story task lands.

// Registers the no-self-review guard as a side effect (T006) — imported
// here, not re-exported, so it always runs before any of this module's
// exported functions are reachable by a caller.
import "./guards";

export { DomainReviewError } from "./errors";
export type { DomainReviewErrorCode } from "./errors";
