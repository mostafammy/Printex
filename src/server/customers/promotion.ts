import { db } from "~/server/db";
import { audit, authorize, getActor } from "~/server/auth";
import type { CustomerInput } from "./schemas";

export async function promoteCashBuyer(input: CustomerInput, orderIds: string[], reason: string) {
  const actor = await getActor();
  authorize(actor, "customer.manage");
  if (!actor.roles.includes("ADMIN_OWNER")) throw new Error("ADMIN_REQUIRED");
  if (!reason.trim()) throw new Error("REASON_REQUIRED");

  return db.$transaction(async (tx) => {
    const cash = await tx.customer.findFirstOrThrow({ where: { isCashCustomer: true } });
    const customer = await tx.customer.create({
      data: {
        name: input.name,
        normalizedName: input.name,
        nationalId: input.nationalId,
        notes: input.notes,
        classificationId: input.classificationId,
        phones: { create: [{ phoneE164: input.primaryPhone, kind: "PRIMARY" }] },
      },
    });
    const orders = await tx.order.findMany({ where: { id: { in: orderIds }, customerId: cash.id }, select: { id: true } });
    if (orders.length !== orderIds.length) throw new Error("INVALID_CASH_ORDER_SELECTION");
    await tx.order.updateMany({ where: { id: { in: orderIds } }, data: { customerId: customer.id } });
    const promotion = await tx.customerPromotion.create({ data: { sourceCustomerId: cash.id, targetCustomerId: customer.id, orderIds, reason, performedById: actor.userId } });
    await audit.record(tx, { action: "customer.promoted", entityType: "CustomerPromotion", entityId: promotion.id, actorId: actor.userId, after: promotion, reason });
    return customer;
  });
}

export async function reversePromotion(promotionId: string, reason: string) {
  const actor = await getActor();
  authorize(actor, "customer.manage");
  if (!actor.roles.includes("ADMIN_OWNER")) throw new Error("ADMIN_REQUIRED");
  if (!reason.trim()) throw new Error("REASON_REQUIRED");

  return db.$transaction(async (tx) => {
    const promotion = await tx.customerPromotion.findUniqueOrThrow({ where: { id: promotionId } });
    if (promotion.reversedAt) throw new Error("PROMOTION_ALREADY_REVERSED");
    const orderIds = Array.isArray(promotion.orderIds) ? promotion.orderIds.filter((id): id is string => typeof id === "string") : [];
    const current = await tx.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, customerId: true } });
    if (current.some((order) => order.customerId !== promotion.targetCustomerId)) throw new Error("PROMOTION_REVERSAL_CONFLICT");
    await tx.order.updateMany({ where: { id: { in: orderIds } }, data: { customerId: promotion.sourceCustomerId } });
    const reversed = await tx.customerPromotion.update({ where: { id: promotionId }, data: { reversedAt: new Date(), reversedById: actor.userId } });
    await audit.record(tx, { action: "customer.promotion_reversed", entityType: "CustomerPromotion", entityId: promotionId, actorId: actor.userId, before: promotion, after: reversed, reason });
    return reversed;
  });
}
