// guards.ts — no-self-review guard (Foundational, T006).
// contracts/review-rework.md's "Guard registration" section, research.md §4.
//
// Registered as a side effect of importing this module — src/server/
// review/index.ts imports it for that side effect, guaranteeing it runs
// before approveDesign (defined in the same module graph) is ever reachable
// by any caller, since every caller must go through the barrel first
// (eslint.config.js's module-boundary rule).

import { db } from "~/server/db";
import { registerGuard } from "~/server/core";
import type { GuardResult } from "~/server/core";
import { isSelfReview } from "./selfReview";

registerGuard({ to: "APPROVED" }, async (ctx): Promise<GuardResult> => {
  const currentVersion = await db.designVersion.findFirst({
    where: { workItemId: ctx.workItem.id },
    orderBy: { version: "desc" },
    select: { uploadedById: true },
  });

  if (isSelfReview(currentVersion?.uploadedById ?? null, ctx.actor.userId)) {
    return {
      ok: false,
      error: {
        code: "GUARD_FAILED",
        message: "A reviewer cannot approve a design version they uploaded themselves.",
      },
    };
  }

  return { ok: true, value: true };
});
