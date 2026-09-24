// aspect.ts — 016 Order Change Control aspect binding.
// contracts/aspects.md §5, research.md §11 (specs/016-change-control/contracts/aspects.md).

import { aspects } from "~/server/aspects";
import type { AspectResult } from "~/server/core";
import type { ChangeError } from "./errors";

export const { defineCommand, defineQuery } = aspects.forModule<ChangeError>({
  module: "changes",
  mapGuardFailure: (guardCode: string) => {
    if (guardCode === "CHANGE_HOLD") {
      return { code: "CHANGE_HOLD" };
    }
    if (guardCode === "LATE_CANCELLATION_REQUIRED") {
      return { code: "LATE_CANCELLATION_REQUIRED" };
    }
    return undefined;
  },
  mapUniqueViolation: (target: readonly string[]) => {
    // SpecVersion @@unique([workItemId, version])
    if (target.includes("version")) {
      return { code: "STALE_SPEC_VERSION" };
    }
    // Partial unique index ChangeRequest_one_pending_per_work_item on (workItemId) WHERE status = 'PENDING'
    if (
      target.includes("workItemId") ||
      target.some((t) => t.includes("ChangeRequest_one_pending") || t.includes("one_pending"))
    ) {
      return { code: "CHANGE_REQUEST_PENDING" };
    }
    return undefined;
  },
});

export type ChangeResult<T> = AspectResult<T, ChangeError>;
