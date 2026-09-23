// audit.record() - FR-019, FR-020. The only code path allowed to write AuditEvent rows.

import type { Prisma } from "../../../generated/prisma";

export const audit = {
  async record(
    tx: Prisma.TransactionClient,
    event: {
      action: string;
      entityType: string;
      entityId: string;
      actorId?: string;
      before?: unknown;
      after?: unknown;
      reason?: string;
      attachmentIds?: string[];
      ip?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        actorId: event.actorId,
        before: event.before as Prisma.InputJsonValue | undefined,
        after: event.after as Prisma.InputJsonValue | undefined,
        reason: event.reason,
        attachmentIds: event.attachmentIds ?? [],
        ipAddress: event.ip,
        userAgent: event.userAgent,
      },
    });
  },
};
