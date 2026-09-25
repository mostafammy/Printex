// Customer finance server actions — 052-finance US3 (T034).
// Credit maintenance: `admin.config` + mandatory reason enforced inside
// updateCredit (service-level, tested); this layer shapes FormData.

"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "~/server/auth";
import { updateCredit } from "~/server/finance";

function formStr(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateCreditAction(customerId: string, formData: FormData): Promise<void> {
  try {
    const actor = await getActor();
    await updateCredit(actor, {
      customerId,
      creditApproved: formStr(formData, "creditApproved") === "true",
      creditLimit: formStr(formData, "creditLimit") || null,
      reason: formStr(formData, "reason"),
    });
    revalidatePath(`/customers/${customerId}`);
  } catch (error) {
    console.error("[finance] credit update failed", error);
  }
}
