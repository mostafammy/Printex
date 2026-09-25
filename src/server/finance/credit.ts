// Customer credit standing — 052-finance US3. FR-010: CustomerCredit is
// finance-owned (not a Customer-master mutation); Admin/Owner only
// (`admin.config`); warn-only enforcement (Clarifications 2026-09-25);
// Cash Customer is never credit-approved.

import { audit, authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import { FINANCE_AUDIT_ACTIONS, requireReason } from "./audit";
import { DomainFinanceError } from "./errors";
import { parseNonNegativeDecimal } from "./money";

export type CreditStanding = {
  readonly customerId: string;
  readonly creditApproved: boolean;
  readonly creditLimit: string | null;
  readonly updatedAt: Date | null;
};

export async function getCreditStanding(customerId: string): Promise<CreditStanding | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true, isCashCustomer: true, customerCredit: true },
  });
  if (!customer) return null;
  return {
    customerId: customer.id,
    creditApproved:
      Boolean(customer.customerCredit?.creditApproved) && !customer.isCashCustomer,
    creditLimit: customer.customerCredit?.creditLimit?.toString() ?? null,
    updatedAt: customer.customerCredit?.updatedAt ?? null,
  };
}

export type UpdateCreditInput = {
  readonly customerId: string;
  readonly creditApproved: boolean;
  readonly creditLimit?: string | null;
  readonly reason: string;
};

/**
 * Admin/Owner write path (FR-010): `admin.config` + mandatory reason
 * (052-local policy) + `credit.updated` audit in the same transaction.
 * Cash Customer is always forced to creditApproved = false.
 */
export async function updateCredit(actor: Actor, input: UpdateCreditInput): Promise<CreditStanding> {
  authorize(actor, "admin.config");
  const reason = requireReason(input.reason, "update a customer's credit standing");

  const creditLimit =
    input.creditLimit === null || input.creditLimit === undefined || input.creditLimit === ""
      ? null
      : parseNonNegativeDecimal(input.creditLimit);
  if (creditLimit?.lte(0)) {
    throw new DomainFinanceError("VALIDATION", "Credit limit must be greater than zero when set");
  }

  await db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true, isCashCustomer: true, customerCredit: true },
    });
    if (!customer) throw new DomainFinanceError("CUSTOMER_NOT_FOUND", "Customer was not found");
    if (customer.isCashCustomer && input.creditApproved) {
      throw new DomainFinanceError("VALIDATION", "The Cash Customer can never be credit-approved");
    }

    const before = customer.customerCredit
      ? {
          creditApproved: customer.customerCredit.creditApproved,
          creditLimit: customer.customerCredit.creditLimit?.toString() ?? null,
        }
      : null;
    const approved = customer.isCashCustomer ? false : input.creditApproved;

    await tx.customerCredit.upsert({
      where: { customerId: customer.id },
      create: {
        customerId: customer.id,
        creditApproved: approved,
        creditLimit,
        updatedById: actor.userId,
        updatedAt: new Date(),
      },
      update: {
        creditApproved: approved,
        creditLimit,
        updatedById: actor.userId,
        updatedAt: new Date(),
      },
    });

    await audit.record(tx, {
      action: FINANCE_AUDIT_ACTIONS.creditUpdated,
      entityType: "CustomerCredit",
      entityId: customer.id,
      actorId: actor.userId,
      before,
      after: { creditApproved: approved, creditLimit: creditLimit?.toString() ?? null },
      reason,
    });
  });

  const standing = await getCreditStanding(input.customerId);
  return standing!;
}
