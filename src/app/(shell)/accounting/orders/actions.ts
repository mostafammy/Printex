"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "~/server/auth";
import { db } from "~/server/db";
import { transitionWorkItem, asUserId, asWorkItemId } from "~/server/core";
import type { Actor as CoreActor } from "~/server/core";
import { audit } from "~/server/auth";
import { setPrice } from "~/server/pricing";

export async function approveAccountantOrderItemAction(
  workItemId: string,
  options?: {
    customPrice?: string;
    note?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await getActor();
    const canApprove =
      actor.roles.includes("ACCOUNTING") ||
      actor.roles.includes("ADMIN_OWNER") ||
      actor.permissions.has("workitem.approve_production") ||
      actor.permissions.has("pricing.use_fixed");

    if (!canApprove) {
      return { ok: false, error: "غير مصرح لك باعتماد الطلبات وإرسالها للإنتاج" };
    }

    const item = await db.workItem.findUnique({
      where: { id: workItemId },
      select: {
        id: true,
        state: true,
        productionTotal: true,
        baseTotal: true,
      },
    });

    if (!item) {
      return { ok: false, error: "أمر العمل غير موجود" };
    }

    if (item.state !== "WAITING_PRICING" && item.state !== "APPROVED") {
      return { ok: false, error: `لا يمكن اعتماد الصنف في حالته الحالية: ${item.state}` };
    }

    // If custom price is provided, set price first
    if (options?.customPrice && options.customPrice.trim().length > 0) {
      await setPrice(actor, {
        workItemId,
        kind: "OVERRIDE",
        amount: options.customPrice.trim(),
        reason: options?.note ?? "تعديل واعتماد السعر من لوحة المحاسب",
      });
    }

    // Determine final amount for approval record
    const amountVal = options?.customPrice
      ? Number(options.customPrice)
      : item.productionTotal
        ? Number(item.productionTotal)
        : item.baseTotal
          ? Number(item.baseTotal)
          : 0;

    const coreActor: CoreActor = {
      userId: asUserId(actor.userId),
      roles: actor.roles,
      departmentIds: actor.departmentIds,
    };

    await db.$transaction(async (tx) => {
      // Create AccountingApproval record
      const approval = await tx.accountingApproval.create({
        data: {
          workItemId,
          approvedById: actor.userId,
          totalAmount: amountVal,
          note: options?.note ?? null,
        },
      });

      // Transition to READY_FOR_PRODUCTION
      const result = await transitionWorkItem(tx, {
        workItemId: asWorkItemId(workItemId),
        to: "READY_FOR_PRODUCTION",
        actor: coreActor,
        reason: options?.note ?? "اعتماد المحاسب والإرسال للطباعة",
        meta: { accountingApprovalId: approval.id },
      });

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      await audit.record(tx, {
        action: "workitem.sent_to_printer",
        entityType: "WorkItem",
        entityId: workItemId,
        actorId: actor.userId,
        after: {
          accountingApprovalId: approval.id,
          to: "READY_FOR_PRODUCTION",
          totalAmount: amountVal,
        },
      });
    });

    revalidatePath("/accounting/orders");
    revalidatePath("/board");
    revalidatePath("/pricing");
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء اعتماد الطلب";
    return { ok: false, error: message };
  }
}
