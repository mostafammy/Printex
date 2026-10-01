"use server";

import { revalidatePath } from "next/cache";
import { getActor, audit } from "~/server/auth";
import { db } from "~/server/db";
import {
  transitionWorkItem,
  openSegment,
  closeOpenSegment,
  asUserId,
  asWorkItemId,
  type Actor as CoreActor,
} from "~/server/core";
import { getOperatorQueuePage, type ProductionQueueRow } from "~/server/production";

export async function loadMoreProductionQueueAction(page: number): Promise<{
  rows: ProductionQueueRow[];
  nextCursor: number | null;
}> {
  const actor = await getActor();
  const result = await getOperatorQueuePage(actor, { page });
  return {
    rows: [...result.rows],
    nextCursor: result.nextCursor,
  };
}

export async function startProductionJobAction(
  workItemId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await getActor();
    const canOperate =
      actor.roles.includes("PRODUCTION_OPERATOR") ||
      actor.roles.includes("ADMIN_OWNER") ||
      actor.permissions.has("production.operate");

    if (!canOperate) {
      return { ok: false, error: "غير مصرح لك ببدء تشغيل أمر الطباعة" };
    }

    const item = await db.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, state: true },
    });

    if (!item) {
      return { ok: false, error: "أمر العمل غير موجود" };
    }

    if (item.state !== "READY_FOR_PRODUCTION") {
      return {
        ok: false,
        error: `لا يمكن بدء التشغيل لأمر عمل بحالته الحالية: ${item.state}`,
      };
    }

    const coreActor: CoreActor = {
      userId: asUserId(actor.userId),
      roles: actor.roles,
      departmentIds: actor.departmentIds,
    };

    await db.$transaction(async (tx) => {
      const result = await transitionWorkItem(tx, {
        workItemId: asWorkItemId(workItemId),
        to: "IN_PRODUCTION",
        actor: coreActor,
        reason: "بدء تشغيل الطباعة",
      });

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      await openSegment(tx, {
        workItemId: asWorkItemId(workItemId),
        phase: "IN_PRODUCTION",
        kind: "ACTIVE",
        userId: asUserId(actor.userId),
      });

      await audit.record(tx, {
        action: "workitem.production_started",
        entityType: "WorkItem",
        entityId: workItemId,
        actorId: actor.userId,
      });
    });

    revalidatePath("/production");
    revalidatePath("/board");
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "فشل بدء تشغيل أمر الطباعة";
    return { ok: false, error: message };
  }
}

export async function completeProductionToDeliveryAction(
  workItemId: string,
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await getActor();
    const canOperate =
      actor.roles.includes("PRODUCTION_OPERATOR") ||
      actor.roles.includes("ADMIN_OWNER") ||
      actor.permissions.has("production.operate");

    if (!canOperate) {
      return { ok: false, error: "غير مصرح لك بإنهاء أمر الطباعة" };
    }

    const item = await db.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, state: true, quantity: true },
    });

    if (!item) {
      return { ok: false, error: "أمر العمل غير موجود" };
    }

    if (item.state !== "IN_PRODUCTION") {
      return {
        ok: false,
        error: `لا يمكن إتمام أمر عمل ليس قيد الإنتاج: ${item.state}`,
      };
    }

    const coreActor: CoreActor = {
      userId: asUserId(actor.userId),
      roles: actor.roles,
      departmentIds: actor.departmentIds,
    };

    await db.$transaction(async (tx) => {
      await closeOpenSegment(tx, {
        workItemId: asWorkItemId(workItemId),
        kind: "ACTIVE",
      });

      // 1. Move to PRODUCTION_COMPLETED
      const res1 = await transitionWorkItem(tx, {
        workItemId: asWorkItemId(workItemId),
        to: "PRODUCTION_COMPLETED",
        actor: coreActor,
        reason: notes?.trim() ? notes.trim() : "اكتمال مرحلة الطباعة والإنتاج",
      });

      if (!res1.ok) {
        throw new Error(res1.error.message);
      }

      await tx.workItem.update({
        where: { id: workItemId },
        data: {
          producedQuantity: item.quantity ?? 1,
          productionNotes: notes?.trim() ? notes.trim() : null,
        },
      });

      // 2. Automatically move to READY_FOR_COLLECTION ("ready to be delivered")
      const res2 = await transitionWorkItem(tx, {
        workItemId: asWorkItemId(workItemId),
        to: "READY_FOR_COLLECTION",
        actor: coreActor,
        reason: "جاهز للتسليم للعميل (نقل تلقائي بعد إنهاء الطباعة)",
      });

      if (!res2.ok) {
        throw new Error(res2.error.message);
      }

      await audit.record(tx, {
        action: "workitem.production_completed",
        entityType: "WorkItem",
        entityId: workItemId,
        actorId: actor.userId,
        after: {
          to: "READY_FOR_COLLECTION",
          producedQuantity: item.quantity ?? 1,
        },
      });
    });

    revalidatePath("/production");
    revalidatePath("/board");
    revalidatePath("/reception");
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "فشل إتمام ونقل أمر الطباعة للتسليم";
    return { ok: false, error: message };
  }
}
