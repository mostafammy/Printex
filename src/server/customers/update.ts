import { db } from "~/server/db";
import { audit, authorize, getActor } from "~/server/auth";
import { normalizeCustomerName } from "./normalizeName";
import { normalizePhone } from "./normalizePhone";
import { customerInput, type CustomerInput } from "./schemas";

export async function updateCustomer(id: string, input: CustomerInput) {
  const actor = await getActor();
  authorize(actor, "customer.manage");
  const parsed = customerInput.parse(input);
  const existing = await db.customer.findUnique({ where: { id }, include: { phones: true, addresses: true } });
  if (!existing) throw new Error("CUSTOMER_NOT_FOUND");
  if (existing.isCashCustomer) throw new Error("CASH_CUSTOMER_IMMUTABLE");

  const normalizedPhones = [parsed.primaryPhone, ...(parsed.alternatePhones ?? [])].map(normalizePhone);
  if (normalizedPhones.some((phone) => !phone.ok)) throw new Error("Invalid phone number");
  const phoneValues = normalizedPhones.flatMap((phone) => (phone.ok ? [phone.value] : []));

  return db.$transaction(async (tx) => {
    const duplicate = await tx.customerPhone.findFirst({ where: { phoneE164: { in: phoneValues }, customerId: { not: id } } });
    if (duplicate) throw new Error("PHONE_ALREADY_EXISTS");
    await tx.customerPhone.deleteMany({ where: { customerId: id } });
    await tx.customerAddress.deleteMany({ where: { customerId: id } });
    const updated = await tx.customer.update({
      where: { id },
      data: {
        name: parsed.name,
        normalizedName: normalizeCustomerName(parsed.name),
        nationalId: parsed.nationalId,
        notes: parsed.notes,
        classificationId: parsed.classificationId,
        phones: { create: phoneValues.map((phoneE164, index) => ({ phoneE164, kind: index === 0 ? "PRIMARY" : "ALTERNATE" })) },
        addresses: parsed.addresses ? { create: parsed.addresses } : undefined,
      },
    });
    await audit.record(tx, { action: "customer.updated", entityType: "Customer", entityId: id, actorId: actor.userId, before: existing, after: updated });
    return updated;
  });
}

export async function archiveCustomer(id: string) {
  const actor = await getActor();
  authorize(actor, "customer.manage");
  if (!actor.roles.includes("ADMIN_OWNER")) throw new Error("ADMIN_REQUIRED");
  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) throw new Error("CUSTOMER_NOT_FOUND");
  if (existing.isCashCustomer) throw new Error("CASH_CUSTOMER_IMMUTABLE");
  return db.$transaction(async (tx) => {
    const archived = await tx.customer.update({ where: { id }, data: { isArchived: true } });
    await audit.record(tx, { action: "customer.archived", entityType: "Customer", entityId: id, actorId: actor.userId, before: existing, after: archived });
    return archived;
  });
}
