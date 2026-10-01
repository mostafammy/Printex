// exceptions.ts — audited width exceptions (093 FR-003, SC-001).
//
// The business rule this file exists to make honest: a banner wider than the
// machine can print is REFUSED, not quietly shrunk. Clamping 330 cm to 320 cm
// would let reception believe it sold a 330 cm banner while the customer
// received a 320 cm one — and it would do so invisibly, which is precisely
// what constitution II forbids.
//
// So the only way past the ceiling is a person, on the record:
//
//   raiseWidthException  — reception says "the customer insists on 330 cm",
//                          with a mandatory reason, producing a PENDING ticket
//   resolveWidthException— a manager (admin.config) approves or rejects it,
//                          with a mandatory note
//   approvedWidthCm      — the ladder value the ticket authorises, so the
//                          frozen production width can be recorded honestly
//                          without pretending 330 cm is a ladder step
//
// A ticket is created once and never deleted; only its resolution fields are
// written, by an explicit audited action (constitution III).

import { type Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { audit, authorize, type Actor } from "~/server/auth";
import { DomainProductionSpecError } from "./errors";

export type WidthExceptionTicketSnapshot = {
  readonly id: string;
  readonly workItemId: string;
  readonly requestedWidthCm: string;
  readonly maxWidthCm: string;
  readonly reason: string;
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly raisedById: string;
  readonly resolvedById: string | null;
  readonly resolutionNote: string | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
};

export type RaiseWidthExceptionInput = {
  readonly workItemId: string;
  readonly requestedWidthCm: Prisma.Decimal;
  /** The ceiling that was exceeded — snapshotted, not looked up later. */
  readonly maxWidthCm: Prisma.Decimal;
  /** Why the customer wants it. Mandatory: an unexplained exception is noise. */
  readonly reason: string;
};

export async function raiseWidthException(
  actor: Actor,
  input: RaiseWidthExceptionInput,
): Promise<WidthExceptionTicketSnapshot> {
  authorize(actor, "order.edit");

  const reason = input.reason.trim();
  if (reason.length === 0) {
    throw new DomainProductionSpecError(
      "WIDTH_EXCEPTION_REQUIRED",
      "A reason is required to raise a width exception",
    );
  }
  if (input.requestedWidthCm.lte(input.maxWidthCm)) {
    throw new DomainProductionSpecError(
      "WIDTH_EXCEPTION_REQUIRED",
      `Width ${input.requestedWidthCm.toString()} cm does not exceed the maximum of ${input.maxWidthCm.toString()} cm, so no exception is needed`,
    );
  }

  return db.$transaction(async (tx) => {
    const ticket = await tx.widthExceptionTicket.create({
      data: {
        workItemId: input.workItemId,
        requestedWidthCm: input.requestedWidthCm,
        maxWidthCm: input.maxWidthCm,
        reason,
        raisedById: actor.userId,
      },
    });
    await audit.record(tx, {
      action: "workitem.width_exception_raised",
      entityType: "WidthExceptionTicket",
      entityId: ticket.id,
      actorId: actor.userId,
      after: {
        workItemId: input.workItemId,
        requestedWidthCm: input.requestedWidthCm.toString(),
        maxWidthCm: input.maxWidthCm.toString(),
        reason,
      },
      reason,
    });
    return toSnapshot(ticket);
  });
}

export type ResolveWidthExceptionInput = {
  readonly ticketId: string;
  readonly decision: "APPROVED" | "REJECTED";
  readonly resolutionNote: string;
};

export async function resolveWidthException(
  actor: Actor,
  input: ResolveWidthExceptionInput,
): Promise<WidthExceptionTicketSnapshot> {
  // Manager-level, not `order.edit`: this is the one action in this feature
  // that overrides a production limit, so it is gated on the same key as
  // other configuration-level overrides.
  authorize(actor, "admin.config");

  const note = input.resolutionNote.trim();
  if (note.length === 0) {
    throw new DomainProductionSpecError(
      "WIDTH_EXCEPTION_REQUIRED",
      "A note is required when resolving a width exception",
    );
  }

  return db.$transaction(async (tx) => {
    // Conditional update, not read-then-write: two managers clicking at once
    // must not both "resolve" the same ticket. `count === 0` means somebody
    // else got there first.
    const { count } = await tx.widthExceptionTicket.updateMany({
      where: { id: input.ticketId, status: "PENDING" },
      data: {
        status: input.decision,
        resolvedById: actor.userId,
        resolutionNote: note,
        resolvedAt: new Date(),
      },
    });
    if (count !== 1) {
      throw new DomainProductionSpecError(
        "WIDTH_EXCEPTION_REQUIRED",
        "This width exception has already been resolved",
      );
    }

    const ticket = await tx.widthExceptionTicket.findUniqueOrThrow({
      where: { id: input.ticketId },
    });
    await audit.record(tx, {
      action: "workitem.width_exception_resolved",
      entityType: "WidthExceptionTicket",
      entityId: ticket.id,
      actorId: actor.userId,
      before: { status: "PENDING" },
      after: { status: input.decision, resolvedById: actor.userId },
      reason: note,
    });
    return toSnapshot(ticket);
  });
}

/**
 * The approved width for a Work Item, or `null` when there is no APPROVED
 * ticket. Consumed by the specification command to decide whether an
 * over-ceiling request may proceed.
 */
export async function approvedWidthException(
  workItemId: string,
): Promise<WidthExceptionTicketSnapshot | null> {
  const ticket = await db.widthExceptionTicket.findFirst({
    where: { workItemId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
  });
  return ticket ? toSnapshot(ticket) : null;
}

/** Manager queue: every unresolved exception, oldest first. */
export async function listPendingWidthExceptions(): Promise<WidthExceptionTicketSnapshot[]> {
  const rows = await db.widthExceptionTicket.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toSnapshot);
}

function toSnapshot(row: {
  id: string;
  workItemId: string;
  requestedWidthCm: Prisma.Decimal;
  maxWidthCm: Prisma.Decimal;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  raisedById: string;
  resolvedById: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}): WidthExceptionTicketSnapshot {
  return {
    id: row.id,
    workItemId: row.workItemId,
    requestedWidthCm: row.requestedWidthCm.toString(),
    maxWidthCm: row.maxWidthCm.toString(),
    reason: row.reason,
    status: row.status,
    raisedById: row.raisedById,
    resolvedById: row.resolvedById,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}
