// Finance server actions for the order detail page — 052-finance US1/US2/US5
// (T022, T027, T045-ish panel hooks). Server-authoritative: getActor →
// service (authorize inside) → revalidatePath. Zod-light validation happens
// in the services; these actions shape FormData and map errors.

"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "../../../../../generated/prisma";
import { getActor } from "~/server/auth";
import {
  orderSummary,
  recordDirectCost,
  recordPayment,
  voidDirectCost,
  voidPayment,
} from "~/server/finance";


function formStr(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function toDateInput(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function fail(error: unknown): void {
  // Plain <form action> UX (repo pattern): log and stop — the service-level
  // tests assert the typed error behavior; nothing partial is committed.
  console.error("[finance] action failed", error);
}

function revalidateOrder(orderId: string): void {
  revalidatePath(`/orders/${orderId}`);
}

export async function recordPaymentAction(orderId: string, formData: FormData): Promise<void> {
  try {
    const actor = await getActor();
    const preset = formStr(formData, "preset");
    let amount = formStr(formData, "amount");

    if (preset) {
      // Preset amounts (FR-021's ≤3-interaction budget): resolve against the
      // CURRENT remaining server-side with Decimal math — the client never
      // computes money (FR-026).
      const summary = await orderSummary(orderId);
      if (summary.status !== "AVAILABLE") {
        return;
      }
      const remaining = new Prisma.Decimal(summary.remaining);
      if (remaining.lte(0)) {
        return;
      }
      if (preset === "full") {
        amount = remaining.toString();
      } else if (preset === "half") {
        amount = remaining.div(2).toDecimalPlaces(2).toString();
      }
    }

    await recordPayment(actor, {
      orderId,
      amount,
      method: formStr(formData, "method"),
      source: formStr(formData, "source"),
      occurredAt: toDateInput(formStr(formData, "occurredAt")),
      note: formStr(formData, "note"),
    });
    revalidateOrder(orderId);
  } catch (error) {
    fail(error);
  }
}

export async function voidPaymentAction(orderId: string, formData: FormData): Promise<void> {
  try {
    const actor = await getActor();
    await voidPayment(actor, {
      paymentId: formStr(formData, "paymentId"),
      reason: formStr(formData, "reason"),
    });
    revalidateOrder(orderId);
  } catch (error) {
    fail(error);
  }
}

export async function recordDirectCostAction(orderId: string, formData: FormData): Promise<void> {
  try {
    const actor = await getActor();
    await recordDirectCost(actor, {
      orderId,
      workItemId: formStr(formData, "workItemId") || undefined,
      amount: formStr(formData, "amount"),
      costDate: formStr(formData, "costDate"),
      description: formStr(formData, "description"),
    });
    revalidateOrder(orderId);
  } catch (error) {
    fail(error);
  }
}

export async function voidDirectCostAction(orderId: string, formData: FormData): Promise<void> {
  try {
    const actor = await getActor();
    await voidDirectCost(actor, {
      directCostId: formStr(formData, "directCostId"),
      reason: formStr(formData, "reason"),
    });
    revalidateOrder(orderId);
  } catch (error) {
    fail(error);
  }
}
