"use server";

import { revalidatePath } from "next/cache";
import { getActor, authorize } from "~/server/auth";
import { createOrder } from "~/server/orders";
import { assignDesigner } from "~/server/designers";
import { createCustomer } from "~/server/customers";
import { loadProductionConstraints, setProductionSpec } from "~/server/production-spec";
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
  discountAmount?: number;
  taxAmount?: number;
  paidAmount?: number;
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
      requiresDesign: true,
      requiresReview: isBanner ? false : true,
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
  // with no `ProductionWidthRule` keeps its existing free-text behaviour, which
  // is what makes the feature additive rather than a breaking change.
  await Promise.all(
    payload.items.map(async (item, index) => {
      const banner = item.bannerSpec;
      if (!banner) return;

      const workItemId = workItemIds[index];
      if (!workItemId) return;

      const constraints = await loadProductionConstraints(item.productTypeId ?? null);
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

  revalidatePath("/reception");
  revalidatePath("/board");
  return { orderId };
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