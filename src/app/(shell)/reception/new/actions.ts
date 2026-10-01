"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "../../../../../generated/prisma";
import { getActor, authorize } from "~/server/auth";
import { assignDesigner } from "~/server/designers";
import { recordPayment } from "~/server/finance";
import { createCustomer } from "~/server/customers";
import { loadReceptionConstraints, setProductionSpec } from "~/server/production-spec";
import { createOrder, listActiveProductTypes } from "~/server/orders";
import type { CustomerSummary, MasterOrderItem } from "~/components/reception/master-order/types";

export interface CreateMasterOrderPayload {
  customerId: string;
  channel?: "WALK_IN" | "WHATSAPP" | "PHONE" | "RETURNING" | "DIRECT_TO_DESIGNER";
  priority: "NORMAL" | "URGENT";
  dueDate?: string;
  salesRep?: string;
  /**
   * The designer this order is handed to. MANDATORY.
   *
   * The pipeline is RECEPTION → DESIGNER → ACCOUNTANT → (BRANDING) → PRINTER
   * and the first edge is not optional: an unassigned Work Item is not an
   * executable designer task, and `transitionWorkItem` refuses to move one out
   * of reception (`DESIGNER_REQUIRED` in `server/pipeline/guards.ts`). This
   * action assigns the designer in the same call that creates the order so the
   * item lands in `ASSIGNED` — the start of the designer stage — rather than
   * being created and then blocked.
   */
  designerId?: string;
  /**
   * Order-level discount and tax, in whole EGP, agreed at the desk.
   *
   * Both are STORED on `Order`, unlike the total itself: the total is derived
   * (each work item's frozen `productionTotal` becomes a `WorkItemPrice`, and
   * `computeOrderSummary` sums those), but a discount agreed with a customer is
   * a decision that has to outlive the conversation. Negative values are
   * refused, and a discount larger than the order's own subtotal is refused too
   * rather than silently clamped — a "discount" that produces a negative invoice
   * is a data-entry mistake, not a deal.
   */
  discountAmount?: number;
  taxAmount?: number;
  /**
   * Whether each amount was entered as a fixed sum or a percentage.
   *
   * Stored alongside the resolved amount because the amount alone loses the
   * shape of the deal: "150.00" could have been a flat 150 or 10% of 1500, and
   * those are not the same promise. The client resolves the percentage to EGP
   * (so there is exactly ONE implementation of that arithmetic) and this only
   * records which one it was.
   */
  discountKind?: "FIXED" | "PERCENT";
  taxKind?: "FIXED" | "PERCENT";
  paidAmount?: number;
  paymentMethod?: string;
  paymentSource?: string;
  items: MasterOrderItem[];
}

export async function createMasterOrderAction(
  payload: CreateMasterOrderPayload,
): Promise<{ orderId: string }> {
  const actor = await getActor();
  authorize(actor, "order.create");

  if (!payload.customerId) {
    throw new Error("يجب اختيار العميل");
  }

  if (!payload.items || payload.items.length === 0) {
    throw new Error("يجب إضافة شغلانة واحدة على الأقل لأمر الطباعة");
  }

  // The rule is enforced HERE, on the server, not in the form. A client that
  // omits the designer — because the form was bypassed, or is stale — must be
  // refused rather than creating an order nobody can execute.
  if (!payload.designerId) {
    throw new Error("يجب تعيين مصمم قبل إنشاء أمر الطباعة — لا يمكن للأمر مغادرة الاستقبال بدون مصمم");
  }

  // Money in, money out — normalised once, validated here, and never inferred
  // from a client-side calculation. Decimals, not floats: 0.1 + 0.2 must not be
  // 0.30000000000000004 on an invoice.
  const discount = toMoney(payload.discountAmount, "الخصم");
  const tax = toMoney(payload.taxAmount, "الضريبة");
  const paid = toMoney(payload.paidAmount, "المدفوع");

  // Summed in Decimal, not `reduce` over floats: adding a dozen float totals
  // then wrapping the result in a Decimal preserves the float error instead of
  // clearing it, and this number is what the "discount is too large" message
  // quotes.
  const quotedSubtotal = payload.items.reduce(
    (sum, item) => sum.plus(new Prisma.Decimal(item.totalCost || 0)),
    new Prisma.Decimal(0),
  );
  if (discount.gt(quotedSubtotal)) {
    throw new Error(
      `الخصم (${discount.toFixed(2)} ج.م) أكبر من إجمالي الشغلانات (${quotedSubtotal.toFixed(2)} ج.م)`,
    );
  }

  // ── Can this actor actually take the deposit? ────────────────────────────
  //
  // Checked HERE, before a single row is written, and with a real message
  // instead of letting `recordPayment` fail three steps later.
  //
  // RECEPTION now holds `payment.record` (migration 20261001120000), because
  // reception takes the customer's money at the counter. This guard is not about
  // that default — it is about every actor who does NOT: a second role opening
  // this form, or the grant being revoked later.
  //
  // Without it, `recordPayment` failed *after* the order, its work items and
  // their frozen specs were already committed — so the receptionist got an
  // opaque 500, a half-written order, and a deposit that was nowhere. The only
  // two acceptable outcomes are "the deposit is recorded" or "the save is
  // refused"; silently creating an order without the deposit is not one of them.
  if (paid.gt(0) && !actor.permissions.has("payment.record")) {
    throw new Error(
      "حسابك لا يملك صلاحية تسجيل الدفعات (payment.record)، لذلك لا يمكن حفظ دفعة مع هذا الأمر. " +
        "امسح خانة المدفوع واحفظ الأمر، ثم سجّل الدفعة من صفحة المالية الخاصة بالأمر.",
    );
  }

  // Map items to WorkItemCreateInput
  const workItems = payload.items.map((item) => {
    const isBanner = Boolean(item.bannerSpec);
    const banner = item.bannerSpec;

    // For a governed roll job the stored dimensions are the CUSTOMER's, in
    // centimetres — the same unit for both, and the same numbers the designer
    // lays out and the printer physically cuts. The rounded-up BILLING width
    // never reaches this row: it is frozen separately by `setProductionSpec`
    // below and is used only for area and money.
    const widthValue = isBanner ? (banner?.customerWidthCm ?? 1) : (item.width ?? 21);
    const heightValue = isBanner ? (banner?.heightCm ?? 1) : (item.height ?? 29.7);
    const dimensionUnit: "M" | "CM" = isBanner ? "CM" : item.measurementUnit === "M" ? "M" : "CM";

    const finishNotesParts: string[] = [];
    if (isBanner && banner?.finishingLines && banner.finishingLines.length > 0) {
      finishNotesParts.push(
        `خدمات إضافية: ${banner.finishingLines.map((f) => `${f.labelAr} (${f.ratePerSqm} ج.م/م²)`).join("، ")}`,
      );
    }
    if (isBanner && banner?.fieldInstallation) {
      finishNotesParts.push("مطلوب خدمة تركيب ميداني");
    }
    if (isBanner) {
      if (banner?.requiresDesign === false) {
        finishNotesParts.push("التصميم جاهز للطباعة (لا يتطلب عمل مصمم)");
      } else {
        finishNotesParts.push("المصمم سيعمل على التصميم");
      }
      if (banner?.attachedFiles && banner.attachedFiles.length > 0) {
        finishNotesParts.push(`ملفات التصميم: ${banner.attachedFiles.join("، ")}`);
      }
    }
    if (item.finishing) {
      finishNotesParts.push(item.finishing);
    }
    if (item.notes) {
      finishNotesParts.push(item.notes);
    }

    const materialDesc = isBanner
      ? `${banner?.printType ?? ""} - ${banner?.materialWeight ?? ""}`
      : (item.material ?? "قياسي");

    const description = `${item.jobName} (${item.categoryLabelAr})`;

    return {
      productTypeId: item.productTypeId ?? undefined,
      departmentId: item.departmentId ?? undefined,
      quantity: Math.max(1, Number(item.quantity) || 1),
      widthValue: Number(widthValue) || 1,
      heightValue: Number(heightValue) || 1,
      dimensionUnit,
      material: materialDesc || undefined,
      finishNotes: finishNotesParts.length > 0 ? finishNotesParts.join(" | ") : undefined,
      requiresDesign: item.requiresDesign ?? item.bannerSpec?.requiresDesign ?? true,
      // ALWAYS true, with no product-type branch.
      //
      // `requiresReview` decides where a finished design lands
      // (server/designers/designVersions.ts, `markDesignComplete`):
      //
      //   true  -> DESIGN_COMPLETED -> WAITING_REVIEW -> APPROVED -> WAITING_PRICING
      //   false -> DESIGN_COMPLETED -> APPROVED        -> WAITING_PRICING
      //
      // The shop's pipeline is RECEPTION -> DESIGNER -> HEAD DESIGNER ->
      // ACCOUNTANT -> PRINTER, so every design is reviewed by the Head Designer
      // before the accountant ever sees it. Setting this from `isBanner` sent
      // every banner and roll job -- the shop's main product -- straight past
      // review to the accountant, because the designer marked it complete and
      // nothing was ever shown to a reviewer.
      //
      // It was previously a per-product-type configuration
      // (`ProductType.defaultRequiresReview`), seeded false for Roll-up Banner on
      // the 093 assumption that this pipeline has no review stage. That
      // assumption is wrong for this business, so the value is now stated here
      // as a single rule rather than derived from the product type. Review is a
      // stage of the pipeline, not a property of a product.
      requiresReview: true,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      description,
    };
  });

  const { orderId, workItemIds } = await createOrder(actor, {
    customerId: payload.customerId,
    channel: payload.channel ?? "WALK_IN",
    priority: payload.priority ?? "NORMAL",
    mode: "GROUPED",
    dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
    discountAmount: discount.toNumber(),
    discountNote: describeMoneyDecision(payload.discountKind, discount),
    taxAmount: tax.toNumber(),
    taxNote: describeMoneyDecision(payload.taxKind, tax),
    workItems,
  });

  // ── Freeze the production specification (093) ───────────────────────────
  //
  // Reception has already shown the receptionist the derived numbers — the roll
  // it will run on, the billable area, the base total, each finishing's share
  // and the grand total — because the modal runs the SAME
  // `deriveProductionSpec` in the browser. Here the server re-derives from its
  // OWN freshly-read configuration and writes the result onto the Work Item.
  //
  // The client sends only INPUTS (customer width, height, quantity, rate,
  // finishing codes) — never a price — so a stale preview cannot become a
  // stored price. If the configuration has moved since the page was rendered,
  // the ladder rounds differently, or the rate has fallen out of the band,
  // `setProductionSpec` refuses and this action fails loudly rather than saving
  // numbers the server cannot reproduce.
  //
  // Only production-spec-governed product types are written this way. A product
  // with no rule and no roll-shaped name keeps its existing free-text behaviour,
  // which is what makes the feature additive rather than a breaking change.
  //
  // The product type NAME is needed here, not just its id, because the roll
  // defaulting heuristic is name-based — the same one the page used to build
  // `governance`, so the preview and the commit resolve identical constraints.
  const productTypesForLookup = await listActiveProductTypes(actor);
  const productTypeById = new Map(productTypesForLookup.map((pt) => [pt.id, pt]));

  await Promise.all(
    payload.items.map(async (item, index) => {
      const banner = item.bannerSpec;
      if (!banner) return;

      const workItemId = workItemIds[index];
      if (!workItemId) return;

      const productType = item.productTypeId
        ? productTypeById.get(item.productTypeId)
        : undefined;
      if (!productType) return;
      const constraints = await loadReceptionConstraints(productType.id, productType.name);
      if (!constraints) return; // not roll-governed — nothing to freeze

      await setProductionSpec(actor, {
        workItemId,
        customerWidthCm: String(banner.customerWidthCm),
        heightCm: String(banner.heightCm),
        quantity: banner.quantity,
        baseRatePerSqm: String(banner.baseRatePerSqm),
        finishingCodes: [...banner.finishingCodes],
      });
    }),
  );

  // ── Hand every item to the designer (RECEPTION → DESIGNER) ───────────────
  await Promise.all(
    workItemIds.map((workItemId) =>
      assignDesigner(actor, workItemId, payload.designerId!, "تعيين من الاستقبال عند إنشاء الأمر"),
    ),
  );

  // ── Record what the customer handed over at the desk ─────────────────────
  //
  // A paid amount is MONEY IN, so it becomes a `Payment` row rather than a field
  // on the order. It was previously accepted by the payload and silently
  // dropped, which meant the receptionist could watch a customer pay, be shown
  // "المتبقي: 0.00", and find the order still fully outstanding.
  //
  // The method and source are the shop's configured defaults for a walk-in at
  // the desk; the receptionist picks them on the payment screen, not while
  // quoting. Recording it here does not yet move the order's derived total —
  // that is the accountant's `setPrice` from the frozen spec, and `Payment`
  // reduces `remaining` on its own.
  if (paid.gt(0)) {
    await recordPayment(actor, {
      orderId,
      amount: String(paid),
      method: payload.paymentMethod ?? "Cash",
      source: payload.paymentSource ?? "Reception desk",
      note: "دفعة عند الاستقبال",
    });
  }

  revalidatePath("/reception");
  revalidatePath("/board");
  return { orderId };
}

/**
 * How a discount or tax was arrived at, recorded next to the amount.
 *
 * Built server-side from the KIND rather than taken as free text: the value has
 * already been resolved to EGP by the client, so what is left to preserve is
 * only "flat" vs "percentage of X" — and an editable text box on a money field
 * is a place for someone to type a second, different number.
 *
 * `null` when the field was left at zero: "no discount agreed" is not a
 * decision worth a note, and a column full of "0.00 EGP" hides the one order
 * that actually had something applied.
 */
function describeMoneyDecision(
  kind: "FIXED" | "PERCENT" | undefined,
  amount: Prisma.Decimal,
): string | undefined {
  if (amount.isZero() || !kind) return undefined;
  return kind === "PERCENT" ? `نسبة مئوية — ${amount.toFixed(2)} ج.م` : `مبلغ ثابت — ${amount.toFixed(2)} ج.م`;
}

/**
 * A money field from the form, normalised to `Decimal` or refused.
 *
 * Three things this refuses that `Number()` would happily accept:
 *
 * - `NaN` / `Infinity`. `Number("")` is `0` but `Number("abc")` is `NaN`, and
 *   `NaN` written into a `Decimal(12,2)` column is either an error at the driver
 *   or a silently wrong invoice. A blank field is legitimately zero, so that is
 *   the only non-numeric input treated as an amount.
 * - Negative amounts. A negative discount is a surcharge with the wrong label;
 *   if a surcharge is wanted it belongs in the price, not in a discount field.
 * - More than two decimal places. The column holds `Decimal(12,2)`; rounding
 *   here means the stored value equals the value the receptionist saw, instead
 *   of the display showing 10.00 and the database holding 10.004.
 */
function toMoney(value: number | undefined, label: string): Prisma.Decimal {
  if (value === undefined || value === null) return new Prisma.Decimal(0);
  if (!Number.isFinite(value)) {
    throw new Error(`${label} يجب أن يكون رقماً صحيحاً`);
  }
  if (value < 0) {
    throw new Error(`${label} لا يمكن أن يكون سالباً`);
  }
  // `toDecimalPlaces(2)` with the default ROUND_HALF_UP, matching what the UI
  // shows (`toFixed(2)`).
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

export async function quickCreateCustomerAction(input: {
  name: string;
  phone: string;
  notes?: string;
}): Promise<CustomerSummary> {
  const customer = await createCustomer({
    name: input.name.trim(),
    primaryPhone: input.phone.trim(),
    notes: input.notes?.trim() ? input.notes.trim() : undefined,
  });

  return {
    id: customer.id,
    name: customer.name,
    phone: input.phone.trim(),
    isCashCustomer: false,
  };
}