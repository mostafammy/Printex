/**
 * Pricing Edge Handlers.
 * (research.md R3, FR-016, contracts/board-server.md §EdgeCatalog)
 */

import { z } from "zod";
import { priceAndReleaseToProduction, quoteForRelease } from "~/server/pricing";
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

export const waitingPricingToReadyForProduction: EdgeHandler = {
  edgeId: "WAITING_PRICING->READY_FOR_PRODUCTION",
  kind: "SHEET",
  sheet: "quick-price",
  permission: "pricing.use_fixed",
  backward: false,
  destructive: false,
  groupable: false,
  labelAr: "تسعير أمر العمل",
  inputSchema: quickPriceSchema,
  // The quick-price modal pops only while pricing is still pending; an
  // already-priced card moves straight through with no interruption.
  needsInput: (card) => card.pricing === "PENDING",
  async execute(actor, card, input) {
    const data = quickPriceSchema.parse(input);
    if (data.kind === "APPLY_QUOTE") {
      const quoted = await quoteForRelease(card.id);
      if (!quoted.ok) throw quoted.error;
      await priceAndReleaseToProduction(actor, { kind: "APPLY_QUOTE", quote: quoted.value, workItemId: card.id });
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
