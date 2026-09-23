// timeline.ts — getVersionTimeline (US4, T031).
// contracts/review-rework.md's `getVersionTimeline` section; data-model.md's
// "Derived values" §Version timeline.
//
// No `authorize()` beyond an authenticated actor — mirrors 012's
// `getMyQueue`/`phaseDurations` "authenticated only" rows (contracts/
// review-rework.md's Authorization table).

import { db } from "~/server/db";
import type { Actor } from "~/server/auth";
import type { RejectionCategory } from "~/server/core";
import { DomainReviewError } from "./errors";

export type TimelineOutcome =
  | { kind: "APPROVED"; approvedById: string; approvedAt: Date }
  | {
      kind: "REJECTED";
      returnId: string;
      category: RejectionCategory;
      explanation: string;
      reviewedById: string;
      reviewedAt: Date;
    }
  | { kind: "PENDING" };

export interface TimelineEntry {
  version: number;
  fileName: string;
  uploadedById: string;
  uploadedAt: Date;
  outcome: TimelineOutcome;
}

export async function getVersionTimeline(
  actor: Actor,
  workItemId: string,
): Promise<TimelineEntry[]> {
  // No permission check beyond `actor` being authenticated (contracts/
  // review-rework.md: "none (authenticated only)"); `actor` is accepted for
  // signature parity with every other function in this module even though
  // it is unused here.
  void actor;

  const workItem = await db.workItem.findUnique({ where: { id: workItemId } });
  if (!workItem) {
    throw new DomainReviewError("WORK_ITEM_NOT_FOUND", `Work Item ${workItemId} not found.`);
  }

  const versions = await db.designVersion.findMany({
    where: { workItemId },
    orderBy: { version: "asc" },
  });

  if (versions.length === 0) return [];

  const returns = await db.return.findMany({
    where: { designVersionId: { in: versions.map((v) => v.id) } },
  });
  const returnByVersionId = new Map(returns.map((r) => [r.designVersionId!, r]));

  return versions.map((version): TimelineEntry => {
    let outcome: TimelineOutcome;

    if (version.approvedAt) {
      outcome = {
        kind: "APPROVED",
        approvedById: version.approvedById!,
        approvedAt: version.approvedAt,
      };
    } else {
      const matchingReturn = returnByVersionId.get(version.id);
      if (matchingReturn) {
        outcome = {
          kind: "REJECTED",
          returnId: matchingReturn.id,
          category: matchingReturn.category,
          explanation: matchingReturn.explanation,
          reviewedById: matchingReturn.raisedById,
          reviewedAt: matchingReturn.createdAt,
        };
      } else {
        outcome = { kind: "PENDING" };
      }
    }

    return {
      version: version.version,
      fileName: version.fileName,
      uploadedById: version.uploadedById,
      uploadedAt: version.createdAt,
      outcome,
    };
  });
}
