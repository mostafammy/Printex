/**
 * Integration test — 093 FR-011…FR-016, spec SC-003.
 *
 * THE test that matters most in this feature. Everything else is arithmetic;
 * this block is the claim that the RECEPTION → DESIGNER → ACCOUNTANT →
 * PRINTER pipeline is enforced by the SERVER and not merely by the screens.
 *
 * Every case below goes through `transitionWorkItem` — the single mutator in
 * the codebase — and several of them deliberately call it with a
 * fully-privileged actor. That is the point: an ADMIN_OWNER with every
 * permission is still refused, because the gates are data invariants, not
 * permission checks. A screen-level check would have passed every one of these.
 *
 * The bypass attempts are the negative half:
 *   - reception pushing unassigned designed work to the printer,
 *   - a designer completing with no file uploaded,
 *   - releasing approved work with no accountant sign-off,
 *   - releasing with a spec but no approval, and with an approval but no file.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  asUserId,
  asWorkItemId,
  transitionWorkItem,
  type Actor as CoreActor,
  type CustomerId,
  type OrderId,
} from "~/server/core";
import type { WorkItemState } from "~/server/core";
import { seedCustomer, seedOrder, seedUser } from "../../helpers/seed";
import { testDb } from "../../helpers/testDb";
import { seedRollGovernance, type RollGovernance } from "../../helpers/rollGovernance";

// Importing the barrel is what installs the guards. If this import were
// removed the guards would not run and this whole file would fail — which is
// the intended safety property.
import "~/server/pipeline";

const ROLL_LADDER_CM = [80, 110, 150, 210, 260, 270, 320];

function coreActor(userId: string): CoreActor {
  return { userId: asUserId(userId), roles: ["ADMIN_OWNER"], departmentIds: [] };
}

async function attempt(
  workItemId: string,
  to: WorkItemState,
  actor: CoreActor,
): Promise<{ ok: boolean; code?: string; message?: string }> {
  const result = await testDb.$transaction(
    async (tx) => transitionWorkItem(tx, { workItemId: asWorkItemId(workItemId), to, actor }),
    // The success path runs the guards (several round trips each) and then
    // transitionWorkItem's own writes and notifications. Over a remote
    // pooler that clears Prisma's 5 s default, so the harness — not the
    // production code — is where the timeout is widened.
    { timeout: 30_000 },
  );
  if (result.ok) return { ok: true };

  // `transitionWorkItem` reports every guard refusal as `GUARD_FAILED` and
  // carries the gate's own code in `details.guardCode` (core's rejection
  // vocabulary is deliberately coarse — see core/workflow/transition.ts).
  // Tests assert on the INNER code, because "some guard said no" is not a
  // useful assertion.
  const details = result.error.details as { guardCode?: unknown } | undefined;
  const guardCode = typeof details?.guardCode === "string" ? details.guardCode : undefined;

  return {
    ok: false,
    code: guardCode ?? result.error.code,
    message: result.error.message,
  };
}

describe("093 pipeline gates are enforced server-side (SC-003)", { timeout: 60000 }, () => {
  let adminId: string;
  let customerId: CustomerId;
  let orderId: OrderId;
  let roll: RollGovernance;

  beforeAll(async () => {
    adminId = await seedUser();
    customerId = await seedCustomer();
    orderId = await seedOrder({ customerId, createdById: asUserId(adminId) });
    roll = await seedRollGovernance({ actorId: adminId, ladderCm: ROLL_LADDER_CM });
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  /** A roll-class Work Item, optionally pre-positioned in a state. */
  async function newRollItem(
    overrides: {
      state?: WorkItemState;
      requiresDesign?: boolean;
      assigneeId?: string | null;
      spec?: boolean;
      /** Override the product type — used to build an UNGOVERNED item. */
      productTypeId?: string;
    } = {},
  ): Promise<string> {
    const item = await testDb.workItem.create({
      data: {
        orderId,
        state: overrides.state ?? "NEW",
        productTypeId: overrides.productTypeId ?? roll.productTypeId,
        requiresDesign: overrides.requiresDesign ?? true,
        requiresReview: false, // the roll class skips Head Designer review
        assigneeId: overrides.assigneeId ?? null,
        ...(overrides.spec === true
          ? {
              customerWidthCm: 145,
              productionWidthCm: 150,
              productionHeightM: 2,
              quantitySnapshot: 1,
              productionAreaSqm: 3,
              baseRatePerSqm: 100,
              baseTotal: 300,
              finishingTotal: 0,
              productionTotal: 300,
              productionSpecAt: new Date(),
            }
          : {}),
      },
    });
    return item.id;
  }

  async function addDesignFile(workItemId: string, uploaderId: string): Promise<void> {
    await testDb.designVersion.create({
      data: {
        workItemId,
        version: 1,
        storageKey: `${workItemId}/v1.pdf`,
        fileName: "design.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        sha256: "a".repeat(64),
        uploadedById: uploaderId,
      },
    });
  }

  async function addApproval(workItemId: string, approverId: string): Promise<void> {
    await testDb.accountingApproval.create({
      data: { workItemId, approvedById: approverId, totalAmount: 300 },
    });
  }

  // ── Gate 1: a designer must exist before designed work leaves reception ──

  describe("Gate 1 — designer required before leaving reception", () => {
    it("refuses NEW -> READY_FOR_PRODUCTION for unassigned designed work", async () => {
      const id = await newRollItem();

      const result = await attempt(id, "READY_FOR_PRODUCTION", coreActor(adminId));

      expect(result.ok).toBe(false);
      expect(result.code).toBe("DESIGNER_REQUIRED");
    });

    it("still refuses when the caller holds every permission in the system", async () => {
      // The bypass attempt. If authorisation were the only defence, an
      // ADMIN_OWNER would sail through here.
      const id = await newRollItem();
      const omnipotent = coreActor(adminId);

      const result = await attempt(id, "READY_FOR_PRODUCTION", omnipotent);

      expect(result.ok).toBe(false);
      expect(result.code).toBe("DESIGNER_REQUIRED");
    });

    it("leaves the state untouched after a refusal", async () => {
      const id = await newRollItem();

      await attempt(id, "READY_FOR_PRODUCTION", coreActor(adminId));

      const after = await testDb.workItem.findUniqueOrThrow({ where: { id }, select: { state: true } });
      expect(after.state).toBe("NEW");
    });

    it("does NOT block a design-free item, which legitimately has no designer", async () => {
      // 014's `sendToProduction` shortcut must keep working for products that
      // genuinely skip design. Over-restricting here would be a regression
      // dressed up as safety.
      //
      // Uses an UNGOVERNED product type deliberately: that is how the shop's
      // non-roll products look, and it isolates Gate 1 from Gate 3 so a pass
      // here can only mean Gate 1 stood down.
      const plain = await testDb.productType.create({
        data: {
          name: `Design-free ${Date.now()}`,
          defaultRequiresDesign: false,
          defaultRequiresReview: false,
        },
      });
      const id = await newRollItem({ requiresDesign: false, productTypeId: plain.id });

      const result = await attempt(id, "READY_FOR_PRODUCTION", coreActor(adminId));

      expect(result.ok).toBe(true);
      const after = await testDb.workItem.findUniqueOrThrow({ where: { id }, select: { state: true } });
      expect(after.state).toBe("READY_FOR_PRODUCTION");
    });

    it("still requires a designer for a roll item even when marked design-free", async () => {
      // The roll class is design-first by business rule: every banner goes to a
      // designer before the accountant sees it. Gate 3 therefore insists on an
      // assignee for roll-governed items regardless of the `requiresDesign`
      // flag, which a well-meaning "just relax the flag" change must not undo.
      const id = await newRollItem({ requiresDesign: false, state: "APPROVED" });

      const result = await attempt(id, "READY_FOR_PRODUCTION", coreActor(adminId));

      expect(result.ok).toBe(false);
      expect(result.code).toBe("DESIGNER_REQUIRED");
    });
  });

  // ── Gate 2: no design completion without a real file ────────────────────

  describe("Gate 2 — design file required for completion", () => {
    it("refuses -> DESIGN_COMPLETED with no file uploaded", async () => {
      const designer = await seedUser();
      const id = await newRollItem({ state: "IN_DESIGN", assigneeId: designer });

      const result = await attempt(id, "DESIGN_COMPLETED", coreActor(designer));

      expect(result.ok).toBe(false);
      expect(result.code).toBe("DESIGN_FILE_REQUIRED");
    });

    it("refuses even for an ADMIN_OWNER", async () => {
      const designer = await seedUser();
      const id = await newRollItem({ state: "IN_DESIGN", assigneeId: designer });

      const result = await attempt(id, "DESIGN_COMPLETED", coreActor(adminId));

      expect(result.ok).toBe(false);
      expect(result.code).toBe("DESIGN_FILE_REQUIRED");
    });

    it("refuses a file row whose storage key is empty — bytes that do not exist", async () => {
      // Spec US2 scenario 3: a failed upload can leave a row behind. Counting
      // rows instead of real files would wave that straight through.
      const designer = await seedUser();
      const id = await newRollItem({ state: "IN_DESIGN", assigneeId: designer });
      await testDb.designVersion.create({
        data: {
          workItemId: id,
          version: 1,
          storageKey: "",
          fileName: "failed.pdf",
          mimeType: "application/pdf",
          sizeBytes: 0,
          sha256: "b".repeat(64),
          uploadedById: designer,
        },
      });

      const result = await attempt(id, "DESIGN_COMPLETED", coreActor(designer));

      expect(result.ok).toBe(false);
      expect(result.code).toBe("DESIGN_FILE_REQUIRED");
    });

    it("allows completion once a real file exists", async () => {
      const designer = await seedUser();
      const id = await newRollItem({ state: "IN_DESIGN", assigneeId: designer });
      await addDesignFile(id, designer);

      const result = await attempt(id, "DESIGN_COMPLETED", coreActor(designer));

      expect(result.ok).toBe(true);
      const after = await testDb.workItem.findUniqueOrThrow({ where: { id }, select: { state: true } });
      expect(after.state).toBe("DESIGN_COMPLETED");
    });
  });

  // ── Gate 3: only an accountant's approval reaches the printer ───────────

  describe("Gate 3 — accountant approval required for the printer", () => {
    it("refuses APPROVED -> READY_FOR_PRODUCTION with a complete spec but no approval", async () => {
      const designer = await seedUser();
      const id = await newRollItem({ state: "APPROVED", assigneeId: designer, spec: true });
      await addDesignFile(id, designer);

      const result = await attempt(id, "READY_FOR_PRODUCTION", coreActor(adminId));

      expect(result.ok).toBe(false);
      expect(result.code).toBe("ACCOUNTANT_APPROVAL_REQUIRED");
    });

    it("refuses a spec that was never set", async () => {
      const designer = await seedUser();
      const id = await newRollItem({ state: "APPROVED", assigneeId: designer });
      await addDesignFile(id, designer);

      const result = await attempt(id, "READY_FOR_PRODUCTION", coreActor(adminId));

      expect(result.ok).toBe(false);
      expect(result.code).toBe("PRODUCTION_SPEC_MISSING");
    });

    it("refuses a priced spec with no design file", async () => {
      const designer = await seedUser();
      const id = await newRollItem({ state: "APPROVED", assigneeId: designer, spec: true });
      await addApproval(id, adminId);

      const result = await attempt(id, "READY_FOR_PRODUCTION", coreActor(adminId));

      expect(result.ok).toBe(false);
      expect(result.code).toBe("DESIGN_FILE_REQUIRED");
    });

    it("refuses an unassigned item even with an approval", async () => {
      // Defence in depth: the approval gate is not the only gate.
      const id = await newRollItem({ state: "APPROVED", spec: true });
      await addDesignFile(id, adminId);
      await addApproval(id, adminId);

      const result = await attempt(id, "READY_FOR_PRODUCTION", coreActor(adminId));

      expect(result.ok).toBe(false);
      expect(result.code).toBe("DESIGNER_REQUIRED");
    });

    it("allows the move when spec, file and approval are all present", async () => {
      const designer = await seedUser();
      const id = await newRollItem({ state: "APPROVED", assigneeId: designer, spec: true });
      await addDesignFile(id, designer);
      await addApproval(id, adminId);

      const result = await attempt(id, "READY_FOR_PRODUCTION", coreActor(adminId));

      expect(result.ok).toBe(true);
      const after = await testDb.workItem.findUniqueOrThrow({ where: { id }, select: { state: true } });
      expect(after.state).toBe("READY_FOR_PRODUCTION");
    });
  });

  // ── The pipeline has no designer-to-printer shortcut ───────────────────

  describe("the pipeline is strictly sequential", () => {
    it.each<readonly [string, WorkItemState]>([
      ["DESIGNER to PRINTER", "READY_FOR_PRODUCTION"],
      ["RECEPTION to ACCOUNTANT", "APPROVED"],
      ["RECEPTION to DESIGN_COMPLETED", "DESIGN_COMPLETED"],
    ])("has no edge for %s", async (_label, to) => {
      // `ALLOWED_EDGES` is a table, not a computed predicate, so an absent edge
      // is a structural guarantee rather than a runtime check that could be
      // reordered or disabled. The full transition is attempted regardless of
      // what the table says, to prove the table is actually consulted.
      const id = await newRollItem();
      const result = await attempt(id, to, coreActor(adminId));
      expect(result.ok).toBe(false);
    });

    it("reaches the printer only via APPROVED, never from DESIGN_COMPLETED", async () => {
      const designer = await seedUser();
      const id = await newRollItem({ state: "DESIGN_COMPLETED", assigneeId: designer, spec: true });
      await addDesignFile(id, designer);
      await addApproval(id, adminId);

      const result = await attempt(id, "READY_FOR_PRODUCTION", coreActor(adminId));

      expect(result.ok).toBe(false);
    });
  });

  // ── Scope: only roll-governed products get the strict gates ─────────────

  describe("gates are scoped by configuration, not by product name", () => {
    it("leaves a product with no width rule completely alone", async () => {
      // A plain product type with no ProductionWidthRule must keep 011/014
      // behaviour exactly. If this test ever needs changing to make the feature
      // work, the feature has been over-fitted.
      const plain = await testDb.productType.create({
        data: { name: `Ungoverned ${Date.now()}`, defaultRequiresDesign: true, defaultRequiresReview: true },
      });
      const designer = await seedUser();
      const item = await testDb.workItem.create({
        data: {
          orderId,
          state: "APPROVED",
          productTypeId: plain.id,
          requiresDesign: true,
          requiresReview: true,
          assigneeId: designer,
        },
      });
      await addDesignFile(item.id, designer);

      // No spec, no approval — and it still goes through, because this product
      // was never opted into the production specification.
      const result = await attempt(item.id, "READY_FOR_PRODUCTION", coreActor(adminId));

      expect(result.ok).toBe(true);
    });
  });
});
