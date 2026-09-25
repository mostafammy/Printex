// Integration test proving every accepted pricing mutation produces an
// AuditEvent — tasks.md T040.
//
// Covers: price change, spec-change reset, configuration mutations
// (policy / price-list / customer-rule), and pricing-originated return.
// Each scenario seeds its own data, performs one accepted operation, and
// asserts the corresponding audit row exists with correct action, entity,
// actor, and payload.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "../../../generated/prisma";
import { testDb } from "../../helpers/testDb";
import {
  seedCustomer,
  seedOrderWithWorkItem,
  seedPriceList,
  seedPricingPolicy,
  seedPricingUser,
  seedProductType,
} from "../../helpers/pricingSeed";
import { audit } from "~/server/auth/audit";
import {
  setPrice,
  quote,
  setPricingPolicy,
  createPriceList,
  retirePriceList,
  createCustomerPricingRule,
  createPricingReturn,
  pricingResetListener,
} from "~/server/pricing";
import type { SpecChangedEvent } from "~/server/pricing";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

let adminActor: Actor;
let priceSetter: Actor;
let customerId: string;
let fixedProductId: string;
let variableProductId: string;
let departmentId: string;

beforeAll(async () => {
  adminActor = await seedPricingUser("audit-admin", ["admin.config", "pricing.use_fixed", "pricing.override"]);
  priceSetter = await seedPricingUser("audit-setter", ["pricing.use_fixed", "pricing.set_variable", "pricing.override"]);
  customerId = await seedCustomer("AuditCoverage");

  fixedProductId = await seedProductType("AuditFixed");
  variableProductId = await seedProductType("AuditVariable");
  await seedPricingPolicy(fixedProductId, "FIXED", adminActor.userId);
  await seedPricingPolicy(variableProductId, "VARIABLE", adminActor.userId);

  await seedPriceList({
    productTypeId: fixedProductId,
    unit: "PIECE",
    createdById: adminActor.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "30" }],
  });
  await seedPriceList({
    productTypeId: variableProductId,
    unit: "PIECE",
    createdById: adminActor.userId,
    tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "30" }],
  });

  // Seed a department for pricing returns (origin department)
  const dept = await testDb.department.create({ data: { name: `AuditDept_${Date.now()}` } });
  departmentId = dept.id;
});

async function freshWorkItem(productTypeId: string): Promise<string> {
  const { workItemId } = await seedOrderWithWorkItem({
    customerId,
    createdById: adminActor.userId,
    productTypeId,
    quantity: 5,
  });
  return workItemId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("pricing audit coverage (integration, T040)", () => {
  // --- Price change -------------------------------------------------------

  it("produces a pricing.price_set audit for an accepted APPLY_QUOTE", async () => {
    const workItemId = await freshWorkItem(fixedProductId);
    const q = await quote({ workItemId, customerId, asOf: new Date("2026-04-01T00:00:00.000Z") });
    expect(q.ok).toBe(true);
    if (!q.ok) return;

    const snapshot = await setPrice(adminActor, { workItemId, kind: "APPLY_QUOTE", quote: q.value });

    const row = await testDb.auditEvent.findFirst({
      where: { action: "pricing.price_set", entityId: snapshot.id },
    });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(adminActor.userId);
    expect(row!.entityType).toBe("WorkItemPrice");
    expect(row!.after).toMatchObject({ workItemId, source: expect.any(String) });
  });

  it("produces a pricing.price_set audit for an accepted VARIABLE price", async () => {
    const workItemId = await freshWorkItem(variableProductId);

    const snapshot = await setPrice(priceSetter, {
      workItemId,
      kind: "VARIABLE",
      amount: "55",
      reason: "Variable audit test",
    });

    const row = await testDb.auditEvent.findFirst({
      where: { action: "pricing.price_set", entityId: snapshot.id },
    });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(priceSetter.userId);
    expect(row!.after).toMatchObject({ source: "MANUAL", reason: "Variable audit test" });
  });

  it("produces a pricing.price_set audit for an accepted OVERRIDE", async () => {
    const workItemId = await freshWorkItem(variableProductId);

    const snapshot = await setPrice(priceSetter, {
      workItemId,
      kind: "OVERRIDE",
      amount: "80",
      reason: "Manager override for audit",
    });

    const row = await testDb.auditEvent.findFirst({
      where: { action: "pricing.price_set", entityId: snapshot.id },
    });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(priceSetter.userId);
    expect(row!.reason).toBe("Manager override for audit");
  });

  // --- Spec-change reset --------------------------------------------------

  it("produces a pricing.reset_after_spec_change audit via the reset listener", async () => {
    const workItemId = await freshWorkItem(variableProductId);

    // Pre-set a price so the reset has a "before" state
    await setPrice(priceSetter, {
      workItemId,
      kind: "VARIABLE",
      amount: "40",
      reason: "prior price",
    });

    // Simulate 016 calling the listener inside its transaction
    await testDb.$transaction(async (tx: Prisma.TransactionClient) => {
      const event: SpecChangedEvent = {
        type: "work_item.spec_changed",
        workItemId,
        orderId: "order-sim",
        fromVersion: 1,
        toVersion: 2,
        specVersionId: "spec-v2",
        origin: "DIRECT_EDIT",
        changeRequestId: null,
        changedFields: ["quantity"],
        workItemState: "IN_PRODUCTION",
        actorId: priceSetter.userId,
        occurredAt: new Date(),
      };
      await pricingResetListener(tx, event);
    });

    const row = await testDb.auditEvent.findFirst({
      where: { action: "pricing.reset_after_spec_change", entityId: workItemId },
    });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(priceSetter.userId);
    expect(row!.entityType).toBe("PricingStatus");
    expect(row!.after).toMatchObject({ status: "PENDING", specVersionId: "spec-v2" });

    // Verify status was actually reset
    const statusRow = await testDb.pricingStatus.findUniqueOrThrow({ where: { workItemId } });
    expect(statusRow.status).toBe("PENDING");
    expect(statusRow.currentPriceId).toBeNull();
  });

  // --- Configuration mutations --------------------------------------------

  it("produces a pricing.policy_changed audit for setPricingPolicy", async () => {
    const productTypeId = await seedProductType("PolicyAudit");

    await setPricingPolicy(adminActor, productTypeId, "VARIABLE");

    const row = await testDb.auditEvent.findFirst({
      where: { action: "pricing.policy_changed", entityId: productTypeId },
    });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(adminActor.userId);
    expect(row!.entityType).toBe("ProductPricingPolicy");
    expect(row!.after).toMatchObject({ mode: "VARIABLE" });
  });

  it("produces a pricing.price_list_created audit for createPriceList", async () => {
    const productTypeId = await seedProductType("PriceListAudit");

    const { priceListId } = await createPriceList(adminActor, {
      productTypeId,
      unit: "PIECE",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "50" }],
    });

    const row = await testDb.auditEvent.findFirst({
      where: { action: "pricing.price_list_created", entityId: priceListId },
    });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(adminActor.userId);
    expect(row!.entityType).toBe("PriceList");
  });

  it("produces a pricing.price_list_retired audit for retirePriceList", async () => {
    const productTypeId = await seedProductType("RetireAudit");
    const { priceListId } = await seedPriceList({
      productTypeId,
      unit: "PIECE",
      createdById: adminActor.userId,
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "45" }],
    });

    await retirePriceList(adminActor, priceListId);

    const row = await testDb.auditEvent.findFirst({
      where: { action: "pricing.price_list_retired", entityId: priceListId },
    });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(adminActor.userId);
    expect(row!.entityType).toBe("PriceList");
  });

  it("produces a pricing.customer_rule_created audit for createCustomerPricingRule", async () => {
    const productTypeId = await seedProductType("CustRuleAudit");

    const { ruleId } = await createCustomerPricingRule(adminActor, {
      customerId,
      productTypeId,
      unit: "PIECE",
      kind: "FIXED",
      fixedPrice: "22",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    });

    const row = await testDb.auditEvent.findFirst({
      where: { action: "pricing.customer_rule_created", entityId: ruleId },
    });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(adminActor.userId);
    expect(row!.entityType).toBe("CustomerPricingRule");
    expect(row!.after).toMatchObject({ customerId, kind: "FIXED" });
  });

  // --- Pricing return -----------------------------------------------------

  it("produces a pricing.return_created audit for createPricingReturn", async () => {
    const workItemId = await freshWorkItem(variableProductId);

    // Pre-price so return has a priced item to send back
    await setPrice(priceSetter, {
      workItemId,
      kind: "VARIABLE",
      amount: "60",
      reason: "priced before return",
    });

    const { returnId } = await createPricingReturn(priceSetter, workItemId, {
      pricingDepartmentId: departmentId,
      assignedToId: priceSetter.userId,
      explanation: "Wrong unit price applied by customer",
    });

    const row = await testDb.auditEvent.findFirst({
      where: { action: "pricing.return_created", entityId: returnId },
    });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(priceSetter.userId);
    expect(row!.entityType).toBe("Return");
    expect(row!.after).toMatchObject({
      workItemId,
      category: "PRICING_ISSUE",
      origin: "PRICING",
    });
  });
});
