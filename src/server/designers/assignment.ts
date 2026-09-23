// assignment.ts — getEligibleDesigners, assignDesigner (US1/US2).
// contracts/designer-assignment.md, data-model.md `EligibleDesigner`.

import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import {
  transitionWorkItem,
  closeOpenSegment,
  notify,
  asUserId,
  asWorkItemId,
} from "~/server/core";
import type { Actor as CoreActor, DomainError, WorkItemState } from "~/server/core";
import { DomainDesignerError } from "./errors";
import { suggestDesigner } from "./suggestion";
import type { DesignerLoadCandidate } from "./suggestion";

function toCoreActor(actor: Actor): CoreActor {
  return { userId: asUserId(actor.userId), roles: actor.roles, departmentIds: actor.departmentIds };
}

/**
 * Surfaces `transitionWorkItem`'s own `Result` error unchanged — mirrors
 * `src/server/orders/cancelOrder.ts`'s `WorkItemTransitionError`: this is
 * NOT wrapped in `DomainDesignerError`, since `transitionWorkItem` already
 * owns the audit write for the transition itself.
 */
export class WorkItemTransitionError extends Error {
  readonly error: DomainError;
  constructor(error: DomainError) {
    super(error.message);
    this.name = "WorkItemTransitionError";
    this.error = error;
  }
}

// Work Item states a designer may be assigned/reassigned into from
// (contracts/designer-assignment.md `getEligibleDesigners` step 2,
// `assignDesigner` step 2a).
const ASSIGNABLE_STATES = new Set<WorkItemState>(["NEW", "ASSIGNED", "REWORK_REQUIRED", "IN_DESIGN"]);

// data-model.md `EligibleDesigner`'s "terminal set" for activeWorkItemCount's
// exclusion — matches 011's `isOrderFinished` terminal-state list.
const TERMINAL_STATES = new Set<WorkItemState>(["DELIVERED", "COMPLETED", "CANCELLED"]);

// research.md §6: a simple derived figure, exact formula left to
// implementation (not contract-frozen) — one queued item costs roughly this
// many minutes of wait for the next designer to reach it.
const ESTIMATED_MINUTES_PER_QUEUED_ITEM = 45;

export interface EligibleDesigner {
  readonly userId: string;
  readonly name: string;
  readonly activeWorkItemCount: number;
  readonly queueSize: number;
  readonly estimatedWaitMinutes: number;
  readonly pastJobsForCustomer: number;
  readonly isSuggested: boolean;
}

/**
 * Active users holding `design.work` via a Role or a per-user extra grant —
 * same role→permission union `getActor()` computes (contracts/
 * designer-assignment.md `getEligibleDesigners` step 3).
 */
async function findActiveDesignWorkHolders(): Promise<Array<{ id: string; name: string }>> {
  return db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { roles: { some: { role: { permissions: { some: { permission: "design.work" } } } } } },
        { extraPermissions: { some: { permission: "design.work" } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getEligibleDesigners(actor: Actor, workItemId: string): Promise<EligibleDesigner[]> {
  authorize(actor, "workitem.assign_designer");

  const workItem = await db.workItem.findUnique({
    where: { id: workItemId },
    select: { id: true, state: true, order: { select: { customerId: true } } },
  });
  if (!workItem) {
    throw new DomainDesignerError("WORK_ITEM_NOT_FOUND", "Work item not found");
  }
  if (!ASSIGNABLE_STATES.has(workItem.state)) {
    throw new DomainDesignerError("NOT_ASSIGNABLE", `Work item state ${workItem.state} is not assignable`);
  }

  const customerId = workItem.order.customerId;
  const designers = await findActiveDesignWorkHolders();

  const candidates: Array<DesignerLoadCandidate & { pastJobsForCustomer: number }> = await Promise.all(
    designers.map(async (designer) => {
      const [activeWorkItemCount, pastJobsForCustomer, lastAssignedTransition] = await Promise.all([
        db.workItem.count({
          where: { assigneeId: designer.id, state: { notIn: [...TERMINAL_STATES] } },
        }),
        db.workItem.count({
          where: {
            assigneeId: designer.id,
            order: { customerId },
            state: { in: ["DELIVERED", "COMPLETED"] },
          },
        }),
        db.workItemTransition.findFirst({
          where: { to: "ASSIGNED", workItem: { assigneeId: designer.id } },
          orderBy: { at: "desc" },
          select: { at: true },
        }),
      ]);

      return {
        userId: designer.id,
        name: designer.name,
        activeWorkItemCount,
        lastAssignedAt: lastAssignedTransition?.at ?? null,
        pastJobsForCustomer,
      };
    }),
  );

  const suggestedId = suggestDesigner(candidates);

  return candidates.map((candidate) => ({
    userId: candidate.userId,
    name: candidate.name,
    activeWorkItemCount: candidate.activeWorkItemCount,
    queueSize: candidate.activeWorkItemCount,
    estimatedWaitMinutes: candidate.activeWorkItemCount * ESTIMATED_MINUTES_PER_QUEUED_ITEM,
    pastJobsForCustomer: candidate.pastJobsForCustomer,
    isSuggested: candidate.userId === suggestedId,
  }));
}

export async function assignDesigner(
  actor: Actor,
  workItemId: string,
  designerId: string,
  reason?: string,
): Promise<void> {
  authorize(actor, "workitem.assign_designer");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const workItem = await tx.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, state: true, assigneeId: true, orderId: true },
    });
    if (!workItem) {
      throw new DomainDesignerError("WORK_ITEM_NOT_FOUND", "Work item not found");
    }
    if (!ASSIGNABLE_STATES.has(workItem.state)) {
      throw new DomainDesignerError("NOT_ASSIGNABLE", `Work item state ${workItem.state} is not assignable`);
    }

    const isReassignment = workItem.assigneeId !== null && workItem.assigneeId !== designerId;

    if (isReassignment) {
      const previousAssigneeId = workItem.assigneeId;
      const trimmedReason = reason?.trim() ?? "";
      if (trimmedReason === "") {
        throw new DomainDesignerError("REASON_REQUIRED", "A reason is required when reassigning a Work Item");
      }

      // No-op if nothing is open (closeOpenSegment's own contract) —
      // preserves the previous designer's already-recorded time
      // (research.md §3, US2 Acceptance Scenario 2).
      await closeOpenSegment(tx, { workItemId: asWorkItemId(workItemId), kind: "ACTIVE" });

      await tx.workItem.update({ where: { id: workItemId }, data: { assigneeId: designerId } });

      await audit.record(tx, {
        action: "workitem.reassigned",
        entityType: "WorkItem",
        entityId: workItemId,
        actorId: actor.userId,
        before: { assigneeId: previousAssigneeId },
        after: { assigneeId: designerId },
        reason: trimmedReason,
      });
    } else {
      // Initial assignment, NEW → ASSIGNED — transitionWorkItem validates the
      // edge and writes WorkItemTransition; assigneeId is set via a
      // tx.workItem.update in the same tx immediately after (both share the
      // transaction, so they commit/roll back together — constitution V).
      const result = await transitionWorkItem(tx, {
        workItemId: asWorkItemId(workItemId),
        to: "ASSIGNED",
        actor: toCoreActor(actor),
      });
      if (!result.ok) {
        throw new WorkItemTransitionError(result.error);
      }

      await tx.workItem.update({ where: { id: workItemId }, data: { assigneeId: designerId } });

      await audit.record(tx, {
        action: "workitem.assigned",
        entityType: "WorkItem",
        entityId: workItemId,
        actorId: actor.userId,
        after: { assigneeId: designerId },
      });
    }

    await notify(tx, {
      type: "workitem.assigned",
      entity: { type: "WorkItem", id: workItemId },
      recipients: { userIds: [designerId] },
      payload: { orderId: workItem.orderId },
    });
  });
}
