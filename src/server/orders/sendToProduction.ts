/**
 * sendToProduction domain action for moving non-design items straight to production.
 * (specs/017-press-floor-board/contracts/board-server.md §sendToProduction, FR-015a, plan.md S1)
 */

import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit, type Actor } from "~/server/auth";
import { transitionWorkItem, asUserId, asWorkItemId } from "~/server/core";
import type { Actor as CoreActor } from "~/server/core";
import { DomainOrderError } from "./errors";
import { WorkItemTransitionError } from "./cancelOrder";

function toCoreActor(actor: Actor): CoreActor {
  return {
    userId: asUserId(actor.userId),
    roles: actor.roles,
    departmentIds: actor.departmentIds,
  };
}

export async function sendToProduction(
  actor: Actor,
  workItemId: string,
  prismaClient = db,
): Promise<void> {
  authorize(actor, "workitem.send_to_production");

  await prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
    const item = await tx.workItem.findUniqueOrThrow({
      where: { id: workItemId },
      select: {
        id: true,
        orderId: true,
        state: true,
        requiresDesign: true,
      },
    });

    if (item.requiresDesign) {
      throw new DomainOrderError(
        "DESIGN_REQUIRED",
        "لا يمكن إرسال أمر عمل يتطلب تصميماً مباشرة إلى الإنتاج",
      );
    }

    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: "READY_FOR_PRODUCTION",
      actor: toCoreActor(actor),
      reason: "إرسال مباشر للإنتاج",
    });

    if (!result.ok) {
      throw new WorkItemTransitionError(result.error);
    }

    await audit.record(tx, {
      action: "workitem.sent_to_production",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
      after: { orderId: item.orderId },
    });
  });
}
