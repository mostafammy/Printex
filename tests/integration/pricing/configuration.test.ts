// Integration test for admin pricing configuration — tasks.md T037, US7.
// Covers policy modes, effective dates, tier overlap, rule precedence,
// retirement history, authorization, and audit.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  seedCustomer,
  seedPricingUser,
  seedProductType,
  seedPriceList,
  seedCustomerRule,
} from "../../helpers/pricingSeed";
import {
  createCustomerPricingRule,
  createPriceList,
  retirePriceList,
  setPricingPolicy,
  DomainPricingError,
} from "~/server/pricing";
import { ForbiddenError } from "~/server/auth/authorize";
import type { Actor } from "~/server/auth";

afterAll(async () => {
  await testDb.$disconnect();
});

let admin: Actor;
let nonAdmin: Actor;
let customerId: string;
let productTypeId: string;

beforeAll(async () => {
  admin = await seedPricingUser("config-admin", ["admin.config"]);
  nonAdmin = await seedPricingUser("config-nonadmin", []);
  customerId = await seedCustomer("ConfigTest");
  productTypeId = await seedProductType("ConfigTestProduct");
});

// ── Policy Modes ─────────────────────────────────────────────────────────────

describe("ProductPricingPolicy mode changes", () => {
  it("creates a FIXED policy and audits the change", async () => {
    await setPricingPolicy(admin, productTypeId, "FIXED");

    const policy = await testDb.productPricingPolicy.findUniqueOrThrow({
      where: { productTypeId },
    });
    expect(policy.mode).toBe("FIXED");
    expect(policy.updatedById).toBe(admin.userId);

    const audit = await testDb.auditEvent.findFirst({
      where: { entityType: "ProductPricingPolicy", entityId: productTypeId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(admin.userId);
  });

  it("upserts from FIXED to VARIABLE and overwrites the policy", async () => {
    await setPricingPolicy(admin, productTypeId, "VARIABLE");

    const policy = await testDb.productPricingPolicy.findUniqueOrThrow({
      where: { productTypeId },
    });
    expect(policy.mode).toBe("VARIABLE");

    // Two audit events exist for the same entity (one per mutation).
    const audits = await testDb.auditEvent.findMany({
      where: { entityType: "ProductPricingPolicy", entityId: productTypeId },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  it("forbids a non-admin user from changing the policy", async () => {
    await expect(
      setPricingPolicy(nonAdmin, productTypeId, "FIXED"),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Policy should remain VARIABLE (unchanged from the previous test).
    const policy = await testDb.productPricingPolicy.findUniqueOrThrow({
      where: { productTypeId },
    });
    expect(policy.mode).toBe("VARIABLE");
  });
});

// ── Effective Dates ──────────────────────────────────────────────────────────

describe("Price list effective dates", () => {
  it("creates a price list with effectiveFrom only (no end date)", async () => {
    const { priceListId } = await createPriceList(admin, {
      productTypeId,
      unit: "PIECE",
      effectiveFrom: new Date("2026-06-01T00:00:00.000Z"),
      tiers: [{ minimumQuantity: 1, maximumQuantity: 10, basePrice: "50" }],
    });
    expect(priceListId).toBeTruthy();
  });

  it("rejects an overlapping effective interval for the same product/unit", async () => {
    await expect(
      createPriceList(admin, {
        productTypeId,
        unit: "PIECE",
        effectiveFrom: new Date("2026-06-15T00:00:00.000Z"),
        effectiveTo: new Date("2026-07-15T00:00:00.000Z"),
        tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "55" }],
      }),
    ).rejects.toMatchObject({
      name: "DomainPricingError",
      code: "EFFECTIVE_DATE_CONFLICT",
    });
  });

  it("allows a non-overlapping interval on a different unit", async () => {
    const { priceListId } = await createPriceList(admin, {
      productTypeId,
      unit: "SQUARE_METER",
      effectiveFrom: new Date("2026-06-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-12-31T00:00:00.000Z"),
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "100" }],
    });
    expect(priceListId).toBeTruthy();
  });

  it("rejects end-date before start-date", async () => {
    await expect(
      createPriceList(admin, {
        productTypeId,
        unit: "SHEET",
        effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
        effectiveTo: new Date("2026-08-01T00:00:00.000Z"),
        tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "10" }],
      }),
    ).rejects.toMatchObject({
      name: "DomainPricingError",
      code: "EFFECTIVE_DATE_CONFLICT",
    });
  });

  it("allows a subsequent non-overlapping interval after retiring the first", async () => {
    const first = await createPriceList(admin, {
      productTypeId,
      unit: "LINEAR_METER",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-06-30T00:00:00.000Z"),
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "70" }],
    });

    await retirePriceList(admin, first.priceListId);

    const second = await createPriceList(admin, {
      productTypeId,
      unit: "LINEAR_METER",
      effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "75" }],
    });
    expect(second.priceListId).toBeTruthy();
  });
});

// ── Tier Overlap ─────────────────────────────────────────────────────────────

describe("Tier overlap and validation", () => {
  it("rejects overlapping quantity tiers within a price list", async () => {
    await expect(
      createPriceList(admin, {
        productTypeId,
        unit: "PACK",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        tiers: [
          { minimumQuantity: 1, maximumQuantity: 50, basePrice: "10" },
          { minimumQuantity: 40, maximumQuantity: 100, basePrice: "8" },
        ],
      }),
    ).rejects.toMatchObject({
      name: "DomainPricingError",
      code: "TIER_OVERLAP",
    });
  });

  it("accepts adjacent (non-overlapping) tiers", async () => {
    const { priceListId } = await createPriceList(admin, {
      productTypeId,
      unit: "PACK",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      tiers: [
        { minimumQuantity: 1, maximumQuantity: 50, basePrice: "10" },
        { minimumQuantity: 51, maximumQuantity: null, basePrice: "8" },
      ],
    });
    expect(priceListId).toBeTruthy();
  });
});

// ── Rule Precedence ──────────────────────────────────────────────────────────

describe("Customer rule precedence", () => {
  it("creates a fixed-price customer rule with future effectiveFrom", async () => {
    const ruleId = await createCustomerPricingRule(admin, {
      customerId,
      productTypeId,
      unit: "PIECE",
      kind: "FIXED",
      fixedPrice: "42",
      effectiveFrom: new Date("2027-01-01T00:00:00.000Z"),
    });
    expect(ruleId).toBeTruthy();
  });

  it("creates a percentage-discount customer rule without overlap", async () => {
    const ruleId = await createCustomerPricingRule(admin, {
      customerId,
      productTypeId,
      unit: "PIECE",
      kind: "PERCENT_DISCOUNT",
      discountPercent: "15",
      effectiveFrom: new Date("2028-01-01T00:00:00.000Z"),
    });
    expect(ruleId).toBeTruthy();
  });

  it("rejects an overlapping customer rule for the same customer/product/unit", async () => {
    await expect(
      createCustomerPricingRule(admin, {
        customerId,
        productTypeId,
        unit: "PIECE",
        kind: "FIXED",
        fixedPrice: "40",
        effectiveFrom: new Date("2027-03-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      name: "DomainPricingError",
      code: "EFFECTIVE_DATE_CONFLICT",
    });
  });

  it("rejects a fixed-price rule with zero or negative amount", async () => {
    await expect(
      createCustomerPricingRule(admin, {
        customerId,
        productTypeId,
        unit: "SHEET",
        kind: "FIXED",
        fixedPrice: "0",
        effectiveFrom: new Date("2027-01-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      name: "DomainPricingError",
      code: "INVALID_AMOUNT",
    });

    await expect(
      createCustomerPricingRule(admin, {
        customerId,
        productTypeId,
        unit: "SHEET",
        kind: "FIXED",
        fixedPrice: "-10",
        effectiveFrom: new Date("2027-01-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      name: "DomainPricingError",
      code: "INVALID_AMOUNT",
    });
  });

  it("rejects a discount at or above 100%", async () => {
    await expect(
      createCustomerPricingRule(admin, {
        customerId,
        productTypeId,
        unit: "SHEET",
        kind: "PERCENT_DISCOUNT",
        discountPercent: "100",
        effectiveFrom: new Date("2027-01-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      name: "DomainPricingError",
      code: "INVALID_AMOUNT",
    });

    await expect(
      createCustomerPricingRule(admin, {
        customerId,
        productTypeId,
        unit: "SHEET",
        kind: "PERCENT_DISCOUNT",
        discountPercent: "110",
        effectiveFrom: new Date("2027-01-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      name: "DomainPricingError",
      code: "INVALID_AMOUNT",
    });
  });
});

// ── Retirement History ───────────────────────────────────────────────────────

describe("Price list retirement and history", () => {
  it("retires a price list and sets status to RETIRED", async () => {
    const { priceListId } = await createPriceList(admin, {
      productTypeId,
      unit: "PACK",
      effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-12-31T00:00:00.000Z"),
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "20" }],
    });

    await retirePriceList(admin, priceListId);

    const list = await testDb.priceList.findUniqueOrThrow({
      where: { id: priceListId },
    });
    expect(list.status).toBe("RETIRED");
  });

  it("audits the retirement event", async () => {
    const { priceListId } = await createPriceList(admin, {
      productTypeId,
      unit: "PACK",
      effectiveFrom: new Date("2027-01-01T00:00:00.000Z"),
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "20" }],
    });

    await retirePriceList(admin, priceListId);

    const audit = await testDb.auditEvent.findFirst({
      where: { entityType: "PriceList", entityId: priceListId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(admin.userId);
  });

  it("preserves the historical record after retirement", async () => {
    const { priceListId } = await seedPriceList({
      productTypeId,
      unit: "PIECE",
      createdById: admin.userId,
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "30" }],
      effectiveFrom: new Date("2026-03-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-08-31T00:00:00.000Z"),
    });

    await retirePriceList(admin, priceListId);

    // Row still exists in the database with all original values intact.
    const list = await testDb.priceList.findUniqueOrThrow({
      where: { id: priceListId },
      include: { tiers: true },
    });
    expect(list.status).toBe("RETIRED");
    expect(list.tiers).toHaveLength(1);
    expect(list.tiers[0].basePrice.toString()).toBe("30");
  });

  it("audits every createPriceList and retirePriceList call", async () => {
    const { priceListId } = await createPriceList(admin, {
      productTypeId,
      unit: "PIECE",
      effectiveFrom: new Date("2029-01-01T00:00:00.000Z"),
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "100" }],
    });

    const createAudit = await testDb.auditEvent.findFirst({
      where: { entityType: "PriceList", entityId: priceListId },
    });
    expect(createAudit).not.toBeNull();

    await retirePriceList(admin, priceListId);

    const audits = await testDb.auditEvent.findMany({
      where: { entityType: "PriceList", entityId: priceListId },
    });
    // At least one for create, one for retire.
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Authorization ────────────────────────────────────────────────────────────

describe("Admin authorization", () => {
  it("forbids non-admin from creating a price list", async () => {
    await expect(
      createPriceList(nonAdmin, {
        productTypeId,
        unit: "PIECE",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "10" }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("forbids non-admin from retiring a price list", async () => {
    const { priceListId } = await seedPriceList({
      productTypeId,
      unit: "PIECE",
      createdById: admin.userId,
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "10" }],
    });

    await expect(retirePriceList(nonAdmin, priceListId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("forbids non-admin from creating a customer pricing rule", async () => {
    await expect(
      createCustomerPricingRule(nonAdmin, {
        customerId,
        productTypeId,
        unit: "PIECE",
        kind: "FIXED",
        fixedPrice: "50",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ── Audit ────────────────────────────────────────────────────────────────────

describe("Audit coverage for configuration mutations", () => {
  it("records an audit event for every configuration mutation", async () => {
    const auditBefore = await testDb.auditEvent.count();

    const pt = await seedProductType("ConfigAudit");
    await setPricingPolicy(admin, pt, "FIXED");

    const { priceListId } = await createPriceList(admin, {
      productTypeId: pt,
      unit: "PIECE",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      tiers: [{ minimumQuantity: 1, maximumQuantity: null, basePrice: "15" }],
    });

    await createCustomerPricingRule(admin, {
      customerId,
      productTypeId: pt,
      unit: "PIECE",
      kind: "FIXED",
      fixedPrice: "12",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    });

    await retirePriceList(admin, priceListId);

    const auditAfter = await testDb.auditEvent.count();
    // At least 4 new audit rows: policy_changed + price_list_created +
    // customer_rule_created + price_list_retired.
    expect(auditAfter - auditBefore).toBeGreaterThanOrEqual(4);
  });
});
