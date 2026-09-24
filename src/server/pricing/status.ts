import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";

export type PricingStatusValue = "PENDING" | "PRICED" | "DISPUTED";

export type PricingStatusSnapshot = {
  readonly workItemId: string;
  readonly status: PricingStatusValue;
  readonly waitingSince: Date | null;
  readonly disputeReason: string | null;
  readonly currentPriceId: string | null;
  readonly updatedById: string | null;
  readonly updatedAt: Date;
};

export type PricingStatusMutation = {
  readonly workItemId: string;
  readonly status: PricingStatusValue;
  readonly waitingSince?: Date | null;
  readonly disputeReason?: string | null;
  readonly currentPriceId?: string | null;
  readonly updatedById?: string | null;
};

type PricingStatusClient = Pick<Prisma.TransactionClient, "pricingStatus">;

export async function persistPricingStatus(
  tx: PricingStatusClient,
  mutation: PricingStatusMutation,
): Promise<void> {
  const waitingSince = mutation.status === "PENDING" ? mutation.waitingSince ?? new Date() : null;

  await tx.pricingStatus.upsert({
    where: { workItemId: mutation.workItemId },
    create: {
      workItemId: mutation.workItemId,
      status: mutation.status,
      waitingSince,
      disputeReason: mutation.disputeReason ?? null,
      currentPriceId: mutation.currentPriceId ?? null,
      updatedById: mutation.updatedById ?? null,
    },
    update: {
      status: mutation.status,
      waitingSince,
      disputeReason: mutation.disputeReason ?? null,
      currentPriceId: mutation.currentPriceId ?? null,
      updatedById: mutation.updatedById ?? null,
    },
  });
}

export async function readPricingStatus(workItemId: string): Promise<PricingStatusSnapshot | null> {
  return db.pricingStatus.findUnique({ where: { workItemId } });
}

export async function readPendingSince(workItemId: string): Promise<Date | null> {
  const pricingStatus = await db.pricingStatus.findUnique({
    where: { workItemId },
    select: { waitingSince: true, status: true },
  });

  return pricingStatus?.status === "PENDING" ? pricingStatus.waitingSince : null;
}