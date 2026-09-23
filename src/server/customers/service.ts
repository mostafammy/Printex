import { db } from "~/server/db";
import { audit, authorize, getActor } from "~/server/auth";
import { normalizeCustomerName } from "./normalizeName";
import { normalizePhone } from "./normalizePhone";
import { customerInput, customerSearchQuery, type CustomerInput, type CustomerSearchQuery } from "./schemas";

export async function findCustomers(input: CustomerSearchQuery) {
  const query = customerSearchQuery.parse(input);
  const text = query.text;
  const limit = query.limit ?? 20;
  const actor = await getActor();
  authorize(actor, "customer.manage");

  const normalizedPhone = normalizePhone(text);
  const phone = normalizedPhone.ok ? normalizedPhone.value : undefined;
  const normalizedName = normalizeCustomerName(text);

  return db.customer.findMany({
    where: {
      ...(query.includeArchived ? {} : { isArchived: false }),
      OR: [
        ...(phone ? [{ phones: { some: { phoneE164: { startsWith: phone } } } }] : []),
        { normalizedName: { contains: normalizedName } },
      ],
    },
    include: { phones: true, classification: true },
    take: limit,
    orderBy: { name: "asc" },
  });
}

export async function getCustomer(id: string) {
  const actor = await getActor();
  authorize(actor, "customer.manage");
  return db.customer.findUnique({
    where: { id },
    include: { phones: true, addresses: true, classification: true, orders: true },
  });
}

export async function createCustomer(input: CustomerInput) {
  const actor = await getActor();
  authorize(actor, "customer.manage");
  const parsed = customerInput.parse(input);
  const phones = [parsed.primaryPhone, ...(parsed.alternatePhones ?? [])].map(normalizePhone);
  if (phones.some((phone) => !phone.ok)) {
    throw new Error("Invalid phone number");
  }
  const canonicalPhones = phones.flatMap((phone) => (phone.ok ? [phone.value] : []));
  const duplicate = await db.customerPhone.findFirst({ where: { phoneE164: { in: canonicalPhones } }, include: { customer: true } });
  if (duplicate) throw new Error(`PHONE_ALREADY_EXISTS:${duplicate.customer.id}`);

  return db.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        name: parsed.name,
        normalizedName: normalizeCustomerName(parsed.name),
        nationalId: parsed.nationalId,
        notes: parsed.notes,
        classificationId: parsed.classificationId,
        phones: { create: canonicalPhones.map((phoneE164, index) => ({ phoneE164, kind: index === 0 ? "PRIMARY" : "ALTERNATE" })) },
        addresses: parsed.addresses ? { create: parsed.addresses } : undefined,
      },
    });
    await audit.record(tx, { action: "customer.created", entityType: "Customer", entityId: customer.id, actorId: actor.userId, after: customer });
    return customer;
  });
}
