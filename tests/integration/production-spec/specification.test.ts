/**
 * Integration test — 093 US1, FR-001…FR-010, FR-024; spec SC-002, SC-006.
 *
 * Reception is where the numbers are decided, so this is where the freeze has
 * to hold. Three properties are asserted, in increasing order of how badly
 * they hurt when broken:
 *
 *   1. the spec's worked example reaches the database intact
 *      (145 cm requested -> 150 cm produced -> 3 m² -> 300 + 270 = 570 EGP);
 *   2. a later configuration change — a new ladder, a new rate, a new
 *      finishing price — does NOT move a quote that has already been given to
 *      a customer (SC-006, the "history never changes" requirement);
 *   3. a re-quote is additive: the superseded generation is still readable.
 *
 * Plus the refusal cases: over-maximum width, over-maximum height, and a base
 * rate outside the configured band.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "../../../generated/prisma";
import type { Actor } from "~/server/auth";
import { DomainProductionSpecError, setProductionSpec, getProductionSpec, previewProductionSpec, raiseWidthException, resolveWidthException } from "~/server/production-spec";
import { seedCustomer, seedOrder, seedUser } from "../../helpers/seed";
import { testDb } from "../../helpers/testDb";
import { seedRollGovernance } from "../../helpers/rollGovernance";

const ROLL_LADDER_CM = [80, 110, 150, 210, 260, 270, 320];

function receptionActor(userId: string): Actor {
  return {
    id: userId,
    userId,
    roles: ["RECEPTION"],
    permissions: new Set(["order.create", "order.edit", "customer.manage"]),
    departmentIds: [],
  };
}

function managerActor(userId: string): Actor {
  return {
    id: userId,
    userId,
    roles: ["ADMIN_OWNER"],
    permissions: new Set(["order.create", "order.edit", "admin.config"]),
    departmentIds: [],
  };
}

describe("093 reception production specification (US1, SC-002, SC-006)", { timeout: 60_000 }, () => {
  let receptionId: string;
  let managerId: string;
  let orderId: string;
  let roll: Awaited<ReturnType<typeof seedRollGovernance>>;
  let sulfanCode: string;

  beforeAll(async () => {
    receptionId = await seedUser();
    managerId = await seedUser();
    const customerId = await seedCustomer();
    orderId = await seedOrder({ customerId, createdById: receptionId as never });

    roll = await seedRollGovernance({
      actorId: managerId,
      ladderCm: ROLL_LADDER_CM,
      finishingRates: { SULFAN: "90", EYELET: "15" },
    });
    sulfanCode = roll.finishings.SULFAN!.code;
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function newItem(state: "NEW" | "ASSIGNED" | "IN_PRODUCTION" = "NEW"): Promise<string> {
    const item = await testDb.workItem.create({
      data: {
        orderId,
        state,
        productTypeId: roll.productTypeId,
        requiresDesign: true,
        requiresReview: false,
      },
    });
    return item.id;
  }

  // ── The worked example ──────────────────────────────────────────────────

  describe("the spec's worked example, end to end", () => {
    it("stores 145 -> 150 cm, 3 m², base 300, Sulfan 270, total 570 EGP", async () => {
      const workItemId = await newItem();

      const spec = await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [sulfanCode],
      });

      expect(spec.customerWidthCm).toBe("145");
      expect(spec.productionWidthCm).toBe("150");
      expect(spec.roundedUp).toBe(true);
      expect(spec.areaSqm).toBe("3");
      expect(spec.baseTotal).toBe("300");
      expect(spec.finishingTotal).toBe("270");
      expect(spec.total).toBe("570");
      expect(spec.currency).toBe("EGP");
    });

    it("keeps the customer's 145 cm next to the 150 cm produced, in the database", async () => {
      const workItemId = await newItem();
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [sulfanCode],
      });

      // FR-001 asserted against the row, not against a return value: the two
      // widths are separate columns precisely so neither can overwrite the
      // other.
      const row = await testDb.workItem.findUniqueOrThrow({
        where: { id: workItemId },
        select: { customerWidthCm: true, productionWidthCm: true },
      });
      expect(row.customerWidthCm?.toString()).toBe("145");
      expect(row.productionWidthCm?.toString()).toBe("150");
    });

    it("freezes the finishing rate onto the Work Item, not just in the return value", async () => {
      const workItemId = await newItem();
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [sulfanCode],
      });

      const rows = await testDb.workItemFinishing.findMany({ where: { workItemId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.rateSnapshot.toString()).toBe("90");
      expect(rows[0]!.totalAmount.toString()).toBe("270");
      expect(rows[0]!.generation).toBe(1);
    });

    it("reads the same numbers back through getProductionSpec", async () => {
      const workItemId = await newItem();
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [sulfanCode],
      });

      const stored = await getProductionSpec(workItemId);

      expect(stored?.total).toBe("570");
      expect(stored?.productionWidthCm).toBe("150");
      expect(stored?.finishings).toHaveLength(1);
      expect(stored?.finishings[0]?.amount).toBe("270");
    });
  });

  // ── SC-006: the freeze ──────────────────────────────────────────────────

  describe("a later configuration change never rewrites a quote", () => {
    // The raised Sulfan price is undone HERE rather than at the end of the test
    // that introduces it, for two reasons. It has to outlive that test — the
    // re-pricing test below is precisely the one that asserts a fresh quote
    // adopts 150 — and it has to be undone even when the test that introduced
    // it fails part-way, or every later test in the file would silently start
    // pricing Sulfan at 150 and fail for a reason that has nothing to do with
    // what they are testing.
    afterAll(async () => {
      await testDb.finishingService.updateMany({
        where: { code: sulfanCode },
        data: { ratePerSqm: new Prisma.Decimal("90") },
      });
    });

    it("keeps the total when the finishing rate is changed afterwards", async () => {
      const workItemId = await newItem();
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [sulfanCode],
      });

      // The shop raises Sulfan from 90 to 150 EGP/m² tomorrow.
      await testDb.finishingService.updateMany({
        where: { code: sulfanCode },
        data: { ratePerSqm: new Prisma.Decimal("150") },
      });

      const stored = await getProductionSpec(workItemId);
      expect(stored?.total).toBe("570");
      expect(stored?.finishings[0]?.ratePerSqm).toBe("90");
    });

    it("keeps the production width when the width ladder is changed afterwards", async () => {
      const workItemId = await newItem();
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [],
      });

      // A bigger machine arrives; 145 cm now rounds to 110 instead of 150.
      await testDb.productionWidthRule.update({
        where: { productTypeId: roll.productTypeId },
        data: { ladderCm: [80, 110, 210, 260, 270, 320] },
      });

      // `finally`, not a trailing statement: a ladder left at 110 would silently
      // change the expected production width of every test that follows.
      try {
        const stored = await getProductionSpec(workItemId);
        expect(stored?.productionWidthCm).toBe("150");
        expect(stored?.total).toBe("300");
      } finally {
        await testDb.productionWidthRule.update({
          where: { productTypeId: roll.productTypeId },
          data: { ladderCm: [...ROLL_LADDER_CM] },
        });
      }
    });

    it("re-prices at the NEW rate only when reception asks again", async () => {
      const workItemId = await newItem();
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [],
      });

      const requoted = await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "110",
        finishingCodes: [],
      });

      // 3 m² x 110 = 330.
      expect(requoted.total).toBe("330");
    });
  });

  // ── Re-quoting is additive (constitution III) ──────────────────────────

  describe("a re-quote supersedes without destroying", () => {
    it("keeps the superseded generation readable when a re-quote drops it", async () => {
      const workItemId = await newItem();
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [sulfanCode],
      });
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [],
      });

      const rows = await testDb.workItemFinishing.findMany({
        where: { workItemId },
        orderBy: { generation: "asc" },
      });

      // The generation-1 row is still there, untouched: the quote the customer
      // was originally given remains reconstructible. (The new quote has no
      // finishings, so it contributes no rows — absence, not deletion.)
      expect(rows).toHaveLength(1);
      expect(rows[0]!.generation).toBe(1);
      expect(rows[0]!.rateSnapshot.toString()).toBe("90");

      // The Work Item reflects the LATEST quote.
      const stored = await getProductionSpec(workItemId);
      expect(stored?.finishingTotal).toBe("0");
      expect(stored?.total).toBe("300");
    });

    it("appends a new generation when a re-quote changes the finishing", async () => {
      const workItemId = await newItem();
      const eyeletCode = roll.finishings.EYELET!.code;
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [sulfanCode],
      });
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [eyeletCode],
      });

      const rows = await testDb.workItemFinishing.findMany({
        where: { workItemId },
        orderBy: { generation: "asc" },
      });

      // Both generations present, each naming the finishing that was quoted at
      // the time. Nothing was deleted or updated in place.
      expect(rows.map((r) => r.generation)).toEqual([1, 2]);
      expect(rows[0]!.finishingServiceId).toBe(roll.finishings.SULFAN!.id);
      expect(rows[1]!.finishingServiceId).toBe(roll.finishings.EYELET!.id);

      // 3 m² x 15 = 45.
      const stored = await getProductionSpec(workItemId);
      expect(stored?.finishingTotal).toBe("45");
      expect(stored?.total).toBe("345");
    });

    it("records an audit event for the first quote and for each re-quote", async () => {
      const workItemId = await newItem();
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [],
      });
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "110",
        finishingCodes: [],
      });

      const events = await testDb.auditEvent.findMany({
        where: { action: "workitem.production_spec_set", entityId: workItemId },
        orderBy: { createdAt: "asc" },
      });

      expect(events).toHaveLength(2);
      // The first quote has no `before`; the re-quote carries the old numbers,
      // which is what makes the change reconstructible.
      expect(events[0]!.before).toBeNull();
      expect(events[1]!.before).not.toBeNull();
    });
  });

  // ── Refusals ────────────────────────────────────────────────────────────

  describe("refusals", () => {
    it("refuses a width above the maximum rather than clamping it", async () => {
      const workItemId = await newItem();

      await expect(
        setProductionSpec(receptionActor(receptionId), {
          workItemId,
          customerWidthCm: "330",
          heightCm: "200",
          quantity: 1,
          baseRatePerSqm: "100",
          finishingCodes: [],
        }),
      ).rejects.toMatchObject({ code: "WIDTH_ABOVE_MAXIMUM" });
    });

    it("refuses a height above the 50 m cap", async () => {
      const workItemId = await newItem();

      await expect(
        setProductionSpec(receptionActor(receptionId), {
          workItemId,
          customerWidthCm: "150",
          heightCm: "5050",
          quantity: 1,
          baseRatePerSqm: "100",
          finishingCodes: [],
        }),
      ).rejects.toMatchObject({ code: "HEIGHT_ABOVE_MAXIMUM" });
    });

    it("accepts a height of exactly the cap", async () => {
      const workItemId = await newItem();

      const spec = await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "150",
        heightCm: "5000",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [],
      });

      expect(spec.heightCm).toBe("5000");
      expect(spec.heightM).toBe("50");
    });

    it.each(["79.99", "120.01"])("refuses a base rate of %s, outside 80-120", async (rate) => {
      const workItemId = await newItem();

      await expect(
        setProductionSpec(receptionActor(receptionId), {
          workItemId,
          customerWidthCm: "150",
          heightCm: "200",
          quantity: 1,
          baseRatePerSqm: rate,
          finishingCodes: [],
        }),
      ).rejects.toMatchObject({ code: "RATE_OUT_OF_BAND" });
    });

    it("refuses an unknown finishing code instead of silently dropping it", async () => {
      // "The customer paid for Sulfan and we quietly dropped it" is the exact
      // failure this feature exists to remove.
      const workItemId = await newItem();

      await expect(
        setProductionSpec(receptionActor(receptionId), {
          workItemId,
          customerWidthCm: "150",
          heightCm: "200",
          quantity: 1,
          baseRatePerSqm: "100",
          finishingCodes: ["NOT_A_REAL_FINISHING"],
        }),
      ).rejects.toMatchObject({ code: "FINISHING_UNAVAILABLE" });
    });

    it("refuses a non-numeric width rather than coercing it to zero", async () => {
      const workItemId = await newItem();

      await expect(
        setProductionSpec(receptionActor(receptionId), {
          workItemId,
          customerWidthCm: "wide",
          heightCm: "200",
          quantity: 1,
          baseRatePerSqm: "100",
          finishingCodes: [],
        }),
      ).rejects.toBeInstanceOf(DomainProductionSpecError);
    });

    it("refuses a product type that has no width rule", async () => {
      const plain = await testDb.productType.create({
        data: { name: `Ungoverned ${Date.now()}`, defaultRequiresDesign: true, defaultRequiresReview: true },
      });
      const item = await testDb.workItem.create({
        data: { orderId, state: "NEW", productTypeId: plain.id, requiresDesign: true, requiresReview: true },
      });

      await expect(
        setProductionSpec(receptionActor(receptionId), {
          workItemId: item.id,
          customerWidthCm: "150",
          heightCm: "200",
          quantity: 1,
          baseRatePerSqm: "100",
          finishingCodes: [],
        }),
      ).rejects.toMatchObject({ code: "NOT_PRODUCTION_SPEC_GOVERNED" });
    });

    it("refuses to re-specify an item that has left reception", async () => {
      // The specification is reception data entry. Once work is on the floor,
      // changing the numbers silently would invalidate a quote the customer has
      // already agreed to.
      const workItemId = await newItem("IN_PRODUCTION");

      await expect(
        setProductionSpec(receptionActor(receptionId), {
          workItemId,
          customerWidthCm: "150",
          heightCm: "200",
          quantity: 1,
          baseRatePerSqm: "100",
          finishingCodes: [],
        }),
      ).rejects.toMatchObject({ code: "WORK_ITEM_NOT_APPLICABLE" });
    });
  });

  // ── The width exception path (FR-003) ──────────────────────────────────

  describe("width exceptions — refuse first, authorise on the record", () => {
    it("still refuses an over-maximum width when no ticket has been approved", async () => {
      const workItemId = await newItem();
      const ticket = await raiseWidthException(receptionActor(receptionId), {
        workItemId,
        requestedWidthCm: new Prisma.Decimal("330"),
        maxWidthCm: new Prisma.Decimal("320"),
        reason: "العميل يطلب 330 سم",
      });
      expect(ticket.status).toBe("PENDING");

      // PENDING is not APPROVED. An un-resolved ticket changes nothing.
      await expect(
        setProductionSpec(receptionActor(receptionId), {
          workItemId,
          customerWidthCm: "330",
          heightCm: "200",
          quantity: 1,
          baseRatePerSqm: "100",
          finishingCodes: [],
        }),
      ).rejects.toMatchObject({ code: "WIDTH_ABOVE_MAXIMUM" });
    });

    it("produces the REQUESTED width, not the ceiling, once a manager approves", async () => {
      const workItemId = await newItem();
      const ticket = await raiseWidthException(receptionActor(receptionId), {
        workItemId,
        requestedWidthCm: new Prisma.Decimal("330"),
        maxWidthCm: new Prisma.Decimal("320"),
        reason: "العميل insists on 330 cm",
      });
      await resolveWidthException(managerActor(managerId), {
        ticketId: ticket.id,
        decision: "APPROVED",
        resolutionNote: "تم中找到 طريقة على الماكينة",
      });

      const spec = await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "330",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [],
      });

      // 3.3 m x 2 m = 6.6 m² at 100 EGP/m² = 660. If the implementation had
      // clamped to 320 cm this would read 640 — and the customer would be
      // short-changed by exactly the amount the exception exists to prevent.
      expect(spec.productionWidthCm).toBe("330");
      expect(spec.areaSqm).toBe("6.6");
      expect(spec.total).toBe("660");
    });

    it("records the approving exception on the quote so the override is visible", async () => {
      const workItemId = await newItem();
      const ticket = await raiseWidthException(receptionActor(receptionId), {
        workItemId,
        requestedWidthCm: new Prisma.Decimal("330"),
        maxWidthCm: new Prisma.Decimal("320"),
        reason: "insists on 330",
      });
      await resolveWidthException(managerActor(managerId), {
        ticketId: ticket.id,
        decision: "APPROVED",
        resolutionNote: "ok",
      });
      await setProductionSpec(receptionActor(receptionId), {
        workItemId,
        customerWidthCm: "330",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [],
      });

      const stored = await getProductionSpec(workItemId);
      expect(stored?.widthException?.id).toBe(ticket.id);
      expect(stored?.widthException?.reason).toBe("insists on 330");
    });

    it("will not resolve the same ticket twice", async () => {
      const workItemId = await newItem();
      const ticket = await raiseWidthException(receptionActor(receptionId), {
        workItemId,
        requestedWidthCm: new Prisma.Decimal("330"),
        maxWidthCm: new Prisma.Decimal("320"),
        reason: "insists on 330",
      });
      await resolveWidthException(managerActor(managerId), {
        ticketId: ticket.id,
        decision: "APPROVED",
        resolutionNote: "ok",
      });

      // Two managers clicking at once must not both "resolve" it.
      await expect(
        resolveWidthException(managerActor(managerId), {
          ticketId: ticket.id,
          decision: "REJECTED",
          resolutionNote: "changed my mind",
        }),
      ).rejects.toMatchObject({ code: "WIDTH_EXCEPTION_REQUIRED" });
    });

    it("refuses to raise an exception for a width that is within the limit", async () => {
      // Otherwise the queue fills with meaningless tickets.
      const workItemId = await newItem();

      await expect(
        raiseWidthException(receptionActor(receptionId), {
          workItemId,
          requestedWidthCm: new Prisma.Decimal("200"),
          maxWidthCm: new Prisma.Decimal("320"),
          reason: "not actually over",
        }),
      ).rejects.toMatchObject({ code: "WIDTH_EXCEPTION_REQUIRED" });
    });

    it("refuses a resolution with no note", async () => {
      const workItemId = await newItem();
      const ticket = await raiseWidthException(receptionActor(receptionId), {
        workItemId,
        requestedWidthCm: new Prisma.Decimal("330"),
        maxWidthCm: new Prisma.Decimal("320"),
        reason: "insists",
      });

      await expect(
        resolveWidthException(managerActor(managerId), {
          ticketId: ticket.id,
          decision: "APPROVED",
          resolutionNote: "   ",
        }),
      ).rejects.toMatchObject({ code: "WIDTH_EXCEPTION_REQUIRED" });
    });
  });

  // ── Preview parity ──────────────────────────────────────────────────────

  describe("the preview is the same function, minus the write", () => {
    it("agrees with the stored quote to the piastre", async () => {
      const previewItem = await newItem();
      const preview = await previewProductionSpec({
        workItemId: previewItem,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [sulfanCode],
      });

      const commitItem = await newItem();
      const committed = await setProductionSpec(receptionActor(receptionId), {
        workItemId: commitItem,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [sulfanCode],
      });

      expect(preview.total).toBe(committed.total);
      expect(preview.productionWidthCm).toBe(committed.productionWidthCm);
      expect(preview.areaSqm).toBe(committed.areaSqm);
      expect(preview.quotedAt).toBeNull();
    });

    it("writes nothing", async () => {
      const workItemId = await newItem();

      await previewProductionSpec({
        workItemId,
        customerWidthCm: "145",
        heightCm: "200",
        quantity: 1,
        baseRatePerSqm: "100",
        finishingCodes: [sulfanCode],
      });

      const row = await testDb.workItem.findUniqueOrThrow({
        where: { id: workItemId },
        select: { productionSpecAt: true, productionTotal: true },
      });
      expect(row.productionSpecAt).toBeNull();
      expect(row.productionTotal).toBeNull();
    });

    it("surfaces the refusal in the preview too, not only on submit", async () => {
      const workItemId = await newItem();

      await expect(
        previewProductionSpec({
          workItemId,
          customerWidthCm: "330",
          heightCm: "200",
          quantity: 1,
          baseRatePerSqm: "100",
          finishingCodes: [],
        }),
      ).rejects.toMatchObject({ code: "WIDTH_ABOVE_MAXIMUM" });
    });
  });
});
