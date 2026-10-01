"use server";

import { revalidatePath } from "next/cache";
import { getActor, authorize } from "~/server/auth";
import { createOrder } from "~/server/orders";
import { createCustomer } from "~/server/customers";
import type { CustomerSummary, MasterOrderItem } from "~/components/reception/master-order/types";

export interface CreateMasterOrderPayload {
  customerId: string;
  channel?: "WALK_IN" | "WHATSAPP" | "PHONE" | "RETURNING" | "DIRECT_TO_DESIGNER";
  priority: "NORMAL" | "URGENT";
  dueDate?: string;
  salesRep?: string;
  discountAmount?: number;
  taxAmount?: number;
  paidAmount?: number;
  items: MasterOrderItem[];
}

export async function createMasterOrderAction(payload: CreateMasterOrderPayload): Promise<{ orderId: string }> {
  const actor = await getActor();
  authorize(actor, "order.create");

  if (!payload.customerId) {
    throw new Error("يجب اختيار العميل");
  }

  if (!payload.items || payload.items.length === 0) {
    throw new Error("يجب إضافة شغلانة واحدة على الأقل لأمر الطباعة");
  }

  // Map items to WorkItemCreateInput
  const workItems = payload.items.map((item) => {
    const isBanner = Boolean(item.bannerSpec);
    const banner = item.bannerSpec;

    const widthValue = isBanner ? (banner?.width ?? 1) : (item.width ?? 21);
    const heightValue = isBanner ? (banner?.height ?? 1) : (item.height ?? 29.7);
    const rawDimUnit = isBanner
      ? banner?.measurementUnit
      : item.measurementUnit;
    const dimensionUnit: "M" | "CM" = rawDimUnit === "M" ? "M" : "CM";

    const finishNotesParts: string[] = [];
    if (isBanner && banner?.finishingOptions && banner.finishingOptions.length > 0) {
      finishNotesParts.push(`تشطيب: ${banner.finishingOptions.join("، ")}`);
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

  const { orderId } = await createOrder(actor, {
    customerId: payload.customerId,
    channel: payload.channel ?? "WALK_IN",
    priority: payload.priority ?? "NORMAL",
    mode: "GROUPED",
    dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
    workItems,
  });

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
