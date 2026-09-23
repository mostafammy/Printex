// Barrel — the ONLY legal import surface from outside src/server/review/**
// (specs/013-review-rework/plan.md "Structure Decision").
// Populated incrementally as each Foundational/User Story task lands.

// Registers the no-self-review guard as a side effect (T006) — imported
// here, not re-exported, so it always runs before any of this module's
// exported functions are reachable by a caller.
import "./guards";

export { DomainReviewError } from "./errors";
export type { DomainReviewErrorCode } from "./errors";

// US1 — src/server/review/queue.ts
export { getReviewQueue } from "./queue";
export type { ReviewQueueRow } from "./queue";

// US2 / US3 — src/server/review/review.ts, src/server/review/returns.ts
export {
  getReviewDetail,
  approveDesign,
  rejectDesign,
  WorkItemTransitionError,
  rejectDesignInputSchema,
} from "./review";
export type { ReviewDetail, VersionSummary, RejectDesignInput } from "./review";
export { createReturn, createReturnInTx, uploadReturnAttachments } from "./returns";
export type { CreateReturnInput, ReturnAttachmentFile, ReturnAttachmentKind } from "./returns";

// US4 — src/server/review/timeline.ts
export { getVersionTimeline } from "./timeline";
export type { TimelineEntry, TimelineOutcome } from "./timeline";
