import type { Prisma } from "~/../generated/prisma";
import { audit } from "~/server/auth";

export function recordCustomerAudit(
  tx: Prisma.TransactionClient,
  event: Parameters<typeof audit.record>[1],
) {
  return audit.record(tx, event);
}
