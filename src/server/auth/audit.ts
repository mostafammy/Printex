// audit.record() - FR-019, FR-020. The only code path allowed to write AuditEvent rows.

import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";

type AuditInput = {
  action: string;
  entityType?: string;
  entity?: string;
  entityId: string;
  actorId?: string;
  before?: unknown;
  beforeValues?: unknown;
  after?: unknown;
  afterValues?: unknown;
  reason?: string;
  attachmentIds?: string[];
  ip?: string;
  userAgent?: string;
};

export const audit: {
  record(event: AuditInput): Promise<void>;
  record(tx: Prisma.TransactionClient, event: AuditInput): Promise<void>;
} = {
  async record(txOrEvent: Prisma.TransactionClient | AuditInput, event?: AuditInput): Promise<void> {
    const tx = event ? txOrEvent as Prisma.TransactionClient : db;
    const input = event ?? txOrEvent as AuditInput;
    await tx.auditEvent.create({
      data: {
        action: input.action,
        entityType: input.entityType ?? input.entity ?? "Unknown",
        entityId: input.entityId,
        actorId: input.actorId,
        before: (input.before ?? input.beforeValues) as Prisma.InputJsonValue | undefined,
        after: (input.after ?? input.afterValues) as Prisma.InputJsonValue | undefined,
        reason: input.reason,
        attachmentIds: input.attachmentIds ?? [],
        ipAddress: input.ip,
        userAgent: input.userAgent,
      },
    });
  },
};
