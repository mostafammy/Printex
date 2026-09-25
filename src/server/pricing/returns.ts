import type { Prisma } from "../../../generated/prisma";
import { audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import { createReturnInTx } from "~/server/review";
import { authorizePricingOperation } from "./authorization";
import { DomainPricingError } from "./errors";

export type PricingReturnInput = {
  readonly pricingDepartmentId: string;
  readonly assignedToId: string;
  readonly explanation: string;
  readonly note?: string;
};

export async function createPricingReturn(
  actor: Actor,
  workItemId: string,
  input: PricingReturnInput,
): Promise<{ returnId: string }> {
  authorizePricingOperation(actor, "OVERRIDE");
  const explanation = input.explanation.trim();
  if (!explanation) {
    throw new DomainPricingError("VALIDATION", "A pricing return requires an explanation");
  }

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const result = await createReturnInTx(tx, actor, workItemId, {
      originDepartmentId: input.pricingDepartmentId,
      category: "PRICING_ISSUE",
      assignedToId: input.assignedToId,
      explanation,
      note: input.note,
    });
    await audit.record(tx, {
      action: "pricing.return_created",
      entityType: "Return",
      entityId: result.returnId,
      actorId: actor.userId,
      after: { workItemId, category: "PRICING_ISSUE", origin: "PRICING" },
    });
    return result;
  });
}