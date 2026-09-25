import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";

// Re-export Prisma-derived enums for the barrel
export type CustomerPricingRuleKind = "FIXED" | "PERCENT_DISCOUNT";
export type PriceConfigStatus = "ACTIVE" | "RETIRED";

export type CustomerPricingRuleRow = {
  id: string;
  customerId: string;
  productTypeId: string;
  kind: CustomerPricingRuleKind;
  fixedPrice: string | null;
  discountPercent: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdById: string;
  createdAt: Date;
  status: PriceConfigStatus;
  productType?: { id: string; name: string } | null;
};

/**
 * Return all CustomerPricingRule rows for a given customer, ordered by
 * product type name then effectiveFrom descending (newest first).
 *
 * Active rules appear before retired rules.  The query requires
 * `customer.manage` authorization.
 */
export async function findCustomerPricingRules(
  customerId: string,
): Promise<CustomerPricingRuleRow[]> {
  const actor = await getActor();
  authorize(actor, "customer.manage");

  const rows = await db.customerPricingRule.findMany({
    where: { customerId },
    include: {
      productType: { select: { id: true, name: true } },
    },
    orderBy: [
      { status: "asc" },        // ACTIVE before RETIRED
      { productType: { name: "asc" } },
      { effectiveFrom: "desc" },
    ],
  });

  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    productTypeId: r.productTypeId,
    kind: r.kind,
    fixedPrice: r.fixedPrice?.toString() ?? null,
    discountPercent: r.discountPercent?.toString() ?? null,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    createdById: r.createdById,
    createdAt: r.createdAt,
    status: r.status,
    productType: r.productType,
  }));
}
