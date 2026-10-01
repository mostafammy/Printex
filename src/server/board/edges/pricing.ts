/**
 * Pricing Edge Handlers.
 * (research.md R3, FR-016, contracts/board-server.md §EdgeCatalog)
 */

import { z } from "zod";
import { db } from "~/server/db";
import { audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { transitionWorkItem, asUserId, asWorkItemId } from "~/server/core";
import type { Actor as CoreActor } from "~/server/core";
import {
  priceAndReleaseToProduction,
  quoteForRelease,
  DomainPricingError,
} from "~/server/pricing";
import type { EdgeHandler } from "../edgeCatalog";

const quickPriceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("APPLY_QUOTE") }),
  z.object({
    kind: z.literal("VARIABLE"),
    amount: z.string().trim().min(1, "يجب إدخال المبلغ"),
    reason: z.string().trim().min(1, "يجب ذكر السبب"),
  }),
  z.object({
    kind: z.literal("OVERRIDE"),
    amount: z.string().trim().min(1, "يجب إدخال المبلغ"),
    reason: z.string().trim().min(1, "يجب ذكر السبب"),
  }),
]);

async function directReleaseToProduction(actor: Actor, cardId: string): Promise<void> {
  const coreActor: CoreActor = {
    userId: asUserId(actor.userId),
    roles: actor.roles,
    departmentIds: actor.departmentIds,
  };
  await db.$transaction(async (tx) => {
    const result = await transitionWorkItem(tx, {
      workItemId: asWorkItemId(cardId),
      to: "READY_FOR_PRODUCTION",
      actor: coreActor,
      reason: "اعتماد التسعير والإرسال لمرحلة الطباعة",
    });
    if (!result.ok) {
      throw new DomainPricingError("RELEASE_FAILED", result.error.message);
    }
    await audit.record(tx, {
      action: "pricing.released_to_production",
      entityType: "WorkItem",
      entityId: cardId,
      actorId: actor.userId,
    });
  });
}

export const waitingPricingToReadyForProduction: EdgeHandler = {
  edgeId: "WAITING_PRICING->READY_FOR_PRODUCTION",
  kind: "SHEET",
  sheet: "quick-price",
  permission: "pricing.use_fixed",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "اعتماد التسعير والإرسال للطباعة",
  inputSchema: quickPriceSchema,
  needsInput: () => true,
  async execute(actor, card, input) {
    if (!input) {
      await directReleaseToProduction(actor, card.id);
      return;
    }

    const data = quickPriceSchema.parse(input);
    if (data.kind === "APPLY_QUOTE") {
      const quoted = await quoteForRelease(card.id);
      if (!quoted.ok) throw quoted.error;
      await priceAndReleaseToProduction(actor, {
        kind: "APPLY_QUOTE",
        quote: quoted.value,
        workItemId: card.id,
      });
      return;
    }
    await priceAndReleaseToProduction(actor, {
      kind: data.kind,
      amount: data.amount,
      reason: data.reason,
      workItemId: card.id,
    });
  },
};

export const pricingEdges: readonly EdgeHandler[] = [
  waitingPricingToReadyForProduction,
];
