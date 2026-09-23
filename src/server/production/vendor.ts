// vendor.ts — recordSentToVendor, recordReceivedFromVendor (US6).
// contracts/production.md, research.md §5 (one VendorProductionRecord per
// production cycle, not two event rows).

import { z } from "zod";
import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { DomainProductionError } from "./errors";
import { effectiveDepartmentId } from "./department";

const vendorNameSchema = z.string().trim().min(1);

async function loadAuthorizedWorkItem(actor: Actor, workItemId: string) {
  const workItem = await db.workItem.findUnique({
    where: { id: workItemId },
    include: { productType: { select: { defaultDepartmentId: true } }, department: true },
  });
  if (!workItem) {
    throw new DomainProductionError("WORK_ITEM_NOT_FOUND", `Work Item ${workItemId} does not exist.`);
  }
  authorize(actor, "production.operate", {
    departmentId: effectiveDepartmentId(workItem) ?? undefined,
  });
  return workItem;
}

export async function recordSentToVendor(
  actor: Actor,
  workItemId: string,
  input: { vendorName: string },
): Promise<{ recordId: string }> {
  const vendorName = vendorNameSchema.parse(input.vendorName);

  const workItem = await loadAuthorizedWorkItem(actor, workItemId);
  if (!workItem.department?.isExternalProduction) {
    throw new DomainProductionError(
      "NOT_EXTERNAL_DEPARTMENT",
      "This Work Item's department is not configured for external production.",
    );
  }

  const recordId = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.vendorProductionRecord.create({
      data: { workItemId, vendorName, createdById: actor.userId },
    });

    await audit.record(tx, {
      action: "workitem.sent_to_vendor",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
      after: { recordId: created.id, vendorName },
    });

    return created.id;
  });

  return { recordId };
}

export async function recordReceivedFromVendor(
  actor: Actor,
  workItemId: string,
  recordId: string,
): Promise<void> {
  await loadAuthorizedWorkItem(actor, workItemId);

  const record = await db.vendorProductionRecord.findUnique({ where: { id: recordId } });
  if (!record || record?.workItemId !== workItemId) {
    throw new DomainProductionError("WORK_ITEM_NOT_FOUND", "Vendor production record not found.");
  }
  if (record.receivedAt !== null) {
    throw new DomainProductionError("ALREADY_RECEIVED", "This vendor production record was already received.");
  }

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.vendorProductionRecord.update({
      where: { id: recordId },
      data: { receivedAt: new Date() },
    });

    await audit.record(tx, {
      action: "workitem.received_from_vendor",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
      after: { recordId },
    });
  });
}
