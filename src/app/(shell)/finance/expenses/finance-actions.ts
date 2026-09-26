// Expenses server actions — 052-finance US4 (T041).
// record/void gated by expense.record, approve by admin.config — enforced
// inside the services; this layer shapes FormData and revalidates.

"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "~/server/auth";
import { approveExpense, recordExpense, voidExpense } from "~/server/finance";

function formStr(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function recordExpenseAction(formData: FormData): Promise<void> {
  try {
    const actor = await getActor();
    const receiptFile = formData.get("receipt");
    const receipt =
      receiptFile instanceof File && receiptFile.size > 0
        ? { stream: receiptFile.stream(), fileName: receiptFile.name }
        : undefined;

    await recordExpense(actor, {
      amount: formStr(formData, "amount"),
      category: formStr(formData, "category"),
      expenseDate: formStr(formData, "expenseDate"),
      employee: formStr(formData, "employee"),
      description: formStr(formData, "description"),
      orderId: formStr(formData, "orderId") || undefined,
      receipt,
    });
    revalidatePath("/finance/expenses");
  } catch (error) {
    console.error("[finance] record expense failed", error);
  }
}

export async function voidExpenseAction(formData: FormData): Promise<void> {
  try {
    const actor = await getActor();
    await voidExpense(actor, {
      expenseId: formStr(formData, "expenseId"),
      reason: formStr(formData, "reason"),
    });
    revalidatePath("/finance/expenses");
  } catch (error) {
    console.error("[finance] void expense failed", error);
  }
}

export async function approveExpenseAction(formData: FormData): Promise<void> {
  try {
    const actor = await getActor();
    await approveExpense(actor, { expenseId: formStr(formData, "expenseId") });
    revalidatePath("/finance/expenses");
  } catch (error) {
    console.error("[finance] approve expense failed", error);
  }
}
