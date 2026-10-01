// guards.ts — the RECEPTION → DESIGNER → ACCOUNTANT → PRINTER gates
// (093 FR-011…FR-016, SC-003).
//
// WHY HERE AND NOT IN THE UI
// --------------------------
// Every gate below is registered through `core`'s `registerGuard`, so it runs
// INSIDE `transitionWorkItem` — the one function every caller in the
// application is obliged to use (constitution V). That is the whole point.
// A gate implemented in a page, a route handler or a React hook protects
// nothing: the same move is one `fetch` away for anyone with a session, which
// is exactly the failure constitution II exists to prevent. Registering here
// means a direct API call to `READY_FOR_PRODUCTION` runs the same checks and
// is refused, and SC-003 is a property of the system rather than of the
// screens.
//
// WHY CONFIGURATION-SCOPED
// -----------------------
// The strictest gates apply only to Work Items whose ProductType has a
// `ProductionWidthRule` — the roll class this feature specifies. A ProductType
// with no rule keeps 011/014's existing behaviour, so adopting this feature
// does not silently break every other product in the shop, and a shop that
// rolls the feature out to more products does it by adding configuration.
// Scope is decided by a `isProductionSpecGoverned` check, never by branching
// on a product name.
//
// The gates, in the order the pipeline meets them:
//
//   designerRequiredBeforeProductionRelease  (NEW → anything)
//        Reception cannot push work to the printer unassigned. Applied to
//        design items only: a genuinely design-free item (requiresDesign =
//        false) legitimately has no designer and must keep its 014 shortcut.
//
//   designFileRequiredForCompletion          (anything → DESIGN_COMPLETED)
//        The designer cannot declare work complete without a file version.
//        Global, and a no-op for existing flows because `markDesignComplete`
//        already refused that case — moving the check into the core path is
//        defence in depth against a direct call.
//
//   accountantApprovalRequiredForPrint       (APPROVED → READY_FOR_PRODUCTION)
//        Only an accountant's recorded approval puts work in front of the
//        printer, and only with a complete, priced, filed specification.
//        Scoped to the roll class so no other product changes behaviour.

import { db } from "~/server/db";
import { registerGuard, type GuardContext, type GuardResult } from "~/server/core";
import { loadProductionConstraints } from "~/server/production-spec/constraints";

/** Human-readable refusal, reused by all three gates. */
function refuse(code: string, message: string): GuardResult {
  return { ok: false, error: { code, message } };
}

/** A design-free item has no designer by definition. */
function gateAppliesToDesignItems(ctx: GuardContext): boolean {
  return ctx.workItem.requiresDesign;
}

/** The configuration switch: does this item's product have a width rule? */
async function isProductionSpecGoverned(ctx: GuardContext): Promise<boolean> {
  const constraints = await loadProductionConstraints(ctx.workItem.productTypeId);
  return constraints !== null;
}

// ── Gate 1: a designer must exist before work can leave reception ─────────
//
// This is the guard that makes `NEW -> READY_FOR_PRODUCTION` — a real edge in
// `ALLOWED_EDGES`, and the one the board's drag-and-drop surface happily
// offers — safe for designed work. 014's `sendToProduction` already refuses
// items with `requiresDesign = true` in application code; registering the same
// rule in the core path means the refusal no longer depends on which entry
// point was used.
registerGuard({ from: "NEW", to: "READY_FOR_PRODUCTION" }, async (ctx) => {
  if (!gateAppliesToDesignItems(ctx)) return { ok: true, value: true };
  if (ctx.workItem.assigneeId !== null) return { ok: true, value: true };

  return refuse(
    "DESIGNER_REQUIRED",
    "يجب تعيين مصمم قبل إرسال العمل إلى الإنتاج",
  );
});

// ── Gate 2: no design completion without an uploaded file ─────────────────
//
// Spec US2 scenario 1 and 3: submitting with no file, or after a failed
// upload, must fail and must not leave a completion state that references
// bytes which do not exist. Checking a DesignVersion row with a non-empty
// storage key is what makes the second half true — a row alone is not enough.
registerGuard({ to: "DESIGN_COMPLETED" }, async (ctx) => {
  const version = await db.designVersion.findFirst({
    where: { workItemId: ctx.workItem.id, storageKey: { not: "" } },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (version) return { ok: true, value: true };

  return refuse(
    "DESIGN_FILE_REQUIRED",
    "يجب رفع ملف التصميم قبل إنهاء مرحلة التصميم",
  );
});

// ── Gate 3: only an accountant's approval reaches the printer ─────────────
//
// The check is deliberately a checklist rather than a single flag, so the
// refusal tells the accountant exactly which requirement is missing (spec US3
// scenario 2) instead of a generic "not allowed". Order is cheapest-first and
// most-fundamental-first: assignment, then specification, then price, then
// file.
registerGuard({ to: "READY_FOR_PRODUCTION" }, async (ctx) => {
  if (!(await isProductionSpecGoverned(ctx))) {
    // Not a roll-class item — 011/014/051's own gates remain in force.
    return { ok: true, value: true };
  }

  if (ctx.workItem.assigneeId === null) {
    return refuse("DESIGNER_REQUIRED", "لا يوجد مصمم مسند لهذا العمل");
  }

  const item = await db.workItem.findUniqueOrThrow({
    where: { id: ctx.workItem.id },
    select: {
      customerWidthCm: true,
      productionWidthCm: true,
      productionHeightM: true,
      productionAreaSqm: true,
      baseRatePerSqm: true,
      baseTotal: true,
      productionTotal: true,
    },
  });

  const missingDimension =
    item.customerWidthCm === null ||
    item.productionWidthCm === null ||
    item.productionHeightM === null ||
    item.productionAreaSqm === null;
  if (missingDimension) {
    return refuse(
      "PRODUCTION_SPEC_MISSING",
      "لا يوجد مقاس إنتاج مُعتمد لهذا العمل — يجب ضبطه من الاستقبال",
    );
  }

  if (item.baseRatePerSqm === null || item.baseTotal === null || item.productionTotal === null) {
    return refuse("PRICING_MISSING", "لا يوجد تسعير مُعتمد لهذا العمل");
  }

  const hasFile = await db.designVersion.findFirst({
    where: { workItemId: ctx.workItem.id, storageKey: { not: "" } },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (!hasFile) {
    return refuse("DESIGN_FILE_REQUIRED", "لا يوجد ملف تصميم صالح معتمد");
  }

  const approval = await db.accountingApproval.findFirst({
    where: { workItemId: ctx.workItem.id },
    orderBy: { approvedAt: "desc" },
    select: { id: true },
  });
  if (!approval) {
    return refuse(
      "ACCOUNTANT_APPROVAL_REQUIRED",
      "لا يمكن الإرسال إلى الطباعة قبل موافقة المحاسب",
    );
  }

  return { ok: true, value: true };
});
