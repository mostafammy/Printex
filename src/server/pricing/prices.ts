import { Prisma } from "../../../generated/prisma";
import { audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import { authorizePricingOperation } from "./authorization";
import { DomainPricingError } from "./errors";
import type { QuoteResult } from "./quote";
import { persistPricingStatus } from "./status";
import { transitionWorkItem, asUserId, asWorkItemId } from "~/server/core";
import type { Actor as CoreActor, Result } from "~/server/core";
import { quote } from "./quote";

export type SetPriceInput =
  | { readonly workItemId: string; readonly kind: "APPLY_QUOTE"; readonly quote: QuoteResult }
  | { readonly workItemId: string; readonly kind: "VARIABLE"; readonly amount: string; readonly reason: string }
  | { readonly workItemId: string; readonly kind: "OVERRIDE"; readonly amount: string; readonly reason: string };

export type PriceSnapshot = {
  readonly id: string;
  readonly workItemId: string;
  readonly amount: string;
  readonly currency: "EGP";
  readonly source: "LIST" | "CUSTOMER_RULE" | "MANUAL";
  readonly reason: string | null;
  readonly setById: string;
  readonly setAt: Date;
};

export async function setPrice(actor: Actor, input: SetPriceInput): Promise<PriceSnapshot> {
  authorizePricingOperation(actor, input.kind);

  const amount = input.kind === "APPLY_QUOTE"
    ? new Prisma.Decimal(input.quote.amount)
    : parseManualAmount(input.amount);
  const reason = input.kind === "APPLY_QUOTE" ? null : input.reason.trim();
  if (input.kind !== "APPLY_QUOTE" && (reason?.length ?? 0) === 0) {
    throw new DomainPricingError("VALIDATION", "A reason is required for manual pricing");
  }

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const workItem = await tx.workItem.findUnique({
      where: { id: input.workItemId },
      include: { productType: { include: { pricingPolicy: true } } },
    });
    if (!workItem) throw new DomainPricingError("PRICE_NOT_FOUND", "Work item was not found");

    const mode = workItem.productType?.pricingPolicy?.mode;
    if (input.kind === "APPLY_QUOTE" && mode !== "FIXED") {
      throw new DomainPricingError("VALIDATION", "Fixed quotes require a FIXED pricing policy");
    }
    if (input.kind === "VARIABLE" && mode !== "VARIABLE") {
      throw new DomainPricingError("VALIDATION", "Variable prices require a VARIABLE pricing policy");
    }

    const source = input.kind === "APPLY_QUOTE"
      ? input.quote.breakdown.customerRuleId ? "CUSTOMER_RULE" : "LIST"
      : "MANUAL";
    const created = await tx.workItemPrice.create({
      data: {
        workItemId: input.workItemId,
        amount,
        currency: "EGP",
        source,
        quoteBreakdown: input.kind === "APPLY_QUOTE"
          ? (input.quote.breakdown as unknown as Prisma.InputJsonValue)
          : undefined,
        setById: actor.userId,
        reason,
      },
    });

    await persistPricingStatus(tx, {
      workItemId: input.workItemId,
      status: "PRICED",
      currentPriceId: created.id,
      updatedById: actor.userId,
    });

    await audit.record(tx, {
      action: "pricing.price_set",
      entityType: "WorkItemPrice",
      entityId: created.id,
      actorId: actor.userId,
      after: { workItemId: input.workItemId, amount: amount.toString(), source, reason },
      reason: reason ?? undefined,
    });

    return {
      id: created.id,
      workItemId: created.workItemId,
      amount: created.amount.toString(),
      currency: "EGP" as const,
      source: created.source,
      reason: created.reason,
      setById: created.setById,
      setAt: created.setAt,
    };
  });
}

/**
 * Fresh server-side quote for a release: the sheet shows a preview, but the
 * applied quote is always recomputed here so a stale or tampered client
 * payload can never set the price.
 */
export async function quoteForRelease(
  workItemId: string,
): Promise<Result<QuoteResult, DomainPricingError>> {
  const item = await db.workItem.findUniqueOrThrow({
    where: { id: workItemId },
    select: { order: { select: { customerId: true } } },
  });
  return quote({ workItemId, customerId: item.order.customerId, asOf: new Date() });
}

/**
 * Quick-price release: sets the price (reusing setPrice's policy checks
 * and PRICED persistence) then releases the item to READY_FOR_PRODUCTION.
 * Powers the board's quick-price sheet so pricing and the production move
 * complete in one operator gesture instead of a page navigation.
 */
export async function priceAndReleaseToProduction(
  actor: Actor,
  input: SetPriceInput,
): Promise<PriceSnapshot> {
  const { workItemId } = input;
  const snapshot = await setPrice(actor, input);

  const coreActor: CoreActor = { userId: asUserId(actor.userId), roles: actor.roles, departmentIds: actor.departmentIds };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(workItemId),
      to: "READY_FOR_PRODUCTION",
      actor: coreActor,
      reason: "تسعير سريع من اللوحة",
    });
    if (!result.ok) {
      throw new DomainPricingError("RELEASE_FAILED", result.error.message);
    }
    await audit.record(tx, {
      action: "pricing.released_to_production",
      entityType: "WorkItem",
      entityId: workItemId,
      actorId: actor.userId,
    });
  });

  return snapshot;
}

function parseManualAmount(value: string): Prisma.Decimal {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new DomainPricingError("INVALID_AMOUNT", "Price must be a valid positive amount");
  }
  if (!amount.isFinite() || amount.isNegative() || amount.isZero()) {
    throw new DomainPricingError("INVALID_AMOUNT", "Price must be a valid positive amount");
  }
  return amount.round();
}