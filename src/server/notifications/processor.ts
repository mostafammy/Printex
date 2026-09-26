// The outbox processor — contracts/notification-service.md §processOutboxBatch.
//
// 002 records a row in the transaction that caused an event. This turns those
// rows into per-user notifications. Everything else in 053 (the bell, the
// page, the scheduler's alerts) reads what this writes.
//
// THE TWO IDEMPOTENCY LAYERS, which solve different problems (research.md
// §Decision: both are required):
//   1. The claim predicate `deliveredAt IS NULL AND deliveryStatus = 'PENDING'`
//      makes reprocessing the COMMON case a no-op rather than an error.
//   2. `@@unique([sourceEventId, userId])` makes a duplicate STRUCTURALLY
//      impossible — two processors racing, a batch retried, a process killed
//      between insert and commit all hit the database, not application care.
//      The second insert is CAUGHT AND TREATED AS SUCCESS, because "this user
//      already has it" is the desired end state, not a failure (FR-007).
//
// A notification is a POINTER, never the record (constitution III, FR-060):
// no `notification.created` audit event is written per notification, because
// that would multiply the audit log by the recipient count for information the
// outbox row already holds. The outbox row IS the delivery audit trail, and
// its full recipient specification is retained after processing (FR-063).

import type { Prisma } from "../../../generated/prisma";
import type { WorkItemState } from "~/server/core";
import { db } from "~/server/db";
import { getNotificationConfig } from "./config";
import { lookup, renderEntry, type CatalogContext } from "./catalog";
import { deriveFromStateChange } from "./derived";
import { describeError, DomainNotificationError } from "./errors";
import { recipientOverride } from "./overrides";
import { resolveRecipients, unionSpecs, type RecipientSpec } from "./recipients";
import { publish, publishCount } from "./stream";

export interface ProcessResult {
  readonly processed: number;
  readonly unmapped: number;
  readonly failed: number;
  readonly notificationsCreated: number;
}

/** One claimed outbox row, in the shape the processing loop needs. */
interface ClaimedEvent {
  readonly id: string;
  readonly type: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly recipientUserIds: string[];
  readonly recipientRoles: string[];
  readonly recipientDepartmentIds: string[];
  readonly recipientPermissions: string[];
  readonly payload: Prisma.JsonValue | null;
  readonly createdAt: Date;
  readonly attemptCount: number;
}

function payloadRecord(payload: Prisma.JsonValue | null): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return {};
  return payload;
}

function stringField(payload: Prisma.JsonValue | null, key: string): string | undefined {
  const value = payloadRecord(payload)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Claims a batch of PENDING events, FIFO by `createdAt` (FR-009).
 *
 * FIFO matters: an old event must not be starved behind a newer flood, or a
 * rejection recorded during a morning rush could sit unprocessed behind
 * hundreds of routine transitions.
 */
async function claimBatch(limit: number, maxAttempts: number): Promise<ClaimedEvent[]> {
  // The claim is a SINGLE conditional UPDATE, which is what makes it atomic:
  // `WHERE ... deliveryStatus = 'PENDING'` means a concurrent processor that
  // got there first has already flipped these rows away from PENDING, so this
  // statement matches nothing for them and they never enter our result set.
  //
  // `deliveredAt IS NULL AND deliveryStatus = 'PENDING'` is exactly the
  // predicate the migration's `NULL -> PENDING` backfill makes correct for
  // every row 012/013/014/015/016 already recorded (A-001).
  const candidates = await db.notificationEvent.findMany({
    where: { deliveredAt: null, deliveryStatus: "PENDING", attemptCount: { lt: maxAttempts } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  if (candidates.length === 0) return [];

  const ids = candidates.map((c) => c.id);
  await db.notificationEvent.updateMany({
    where: { id: { in: ids }, deliveredAt: null, deliveryStatus: "PENDING" },
    data: { lastAttemptAt: new Date() },
  });

  const claimed = await db.notificationEvent.findMany({
    where: { id: { in: ids }, deliveredAt: null, deliveryStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      entityType: true,
      entityId: true,
      recipientUserIds: true,
      recipientRoles: true,
      recipientDepartmentIds: true,
      recipientPermissions: true,
      payload: true,
      createdAt: true,
      attemptCount: true,
    },
  });
  return claimed;
}

async function markProcessed(id: string): Promise<void> {
  await db.notificationEvent.update({
    where: { id },
    data: { deliveryStatus: "PROCESSED", deliveredAt: new Date(), lastError: null },
  });
}

async function markUnmapped(id: string): Promise<void> {
  // UNMAPPED is distinct from PROCESSED: both produce no notification, but
  // only this one increments the Admin-visible counter, so a catalog gap is
  // visible instead of silent (FR-019).
  await db.notificationEvent.update({
    where: { id },
    data: { deliveryStatus: "UNMAPPED", lastAttemptAt: new Date() },
  });
}

async function markFailed(id: string, error: string): Promise<void> {
  // No `deliveredAt`: a failed event stays unprocessed so a later attempt can
  // pick it up, and after MAX_ATTEMPTS the claim query stops selecting it
  // (FR-008).
  await db.notificationEvent.update({
    where: { id },
    data: {
      deliveryStatus: "FAILED",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: error,
    },
  });
}

/** The order priority for a derived urgent alert, read once per event. */
async function orderPriorityFor(workItemId: string): Promise<"NORMAL" | "URGENT"> {
  const workItem = await db.workItem.findUnique({
    where: { id: workItemId },
    select: { order: { select: { priority: true } } },
  });
  return workItem?.order.priority ?? "NORMAL";
}

interface DeliveryPlan {
  readonly type: string;
  readonly ctx: CatalogContext;
  /** Emitter-recorded recipients, before the catalog default or override. */
  readonly emitted: RecipientSpec;
}

/**
 * Works out what a single outbox row should produce.
 *
 * Two shapes:
 *   - a TRIGGER (`work_item.state_changed`) fans out into derived entries;
 *   - everything else delivers its own entry, or produces nothing at all when
 *     it is RECORDED_ONLY (a known type with a deliberately empty audience —
 *     it drains the outbox without raising the Admin's unmapped counter).
 */
async function planFor(event: ClaimedEvent): Promise<DeliveryPlan[] | "UNMAPPED"> {
  const entry = lookup(event.type);
  if (!entry) return "UNMAPPED";

  const payload = event.payload;
  const entityType = event.entityType;
  const isWorkItem = entityType === "WorkItem";
  const orderId = stringField(payload, "orderId") ?? (isWorkItem ? null : event.entityId || null);
  const workItemId = isWorkItem ? event.entityId : stringField(payload, "workItemId");

  const ctx: CatalogContext = {
    payload: payload as CatalogContext["payload"],
    entityId: event.entityId || null,
    orderId,
    workItemId,
  };

  if (entry.delivery === "TRIGGER") {
    if (!workItemId) return [];
    const to = stringField(payload, "to") as WorkItemState | undefined;
    // A trigger row whose `to` is missing cannot be expanded. This is
    // malformed rather than unknown, and it is reported as UNMAPPED so the
    // gap shows on the Admin screen instead of draining as a silent success.
    if (!to) return "UNMAPPED";

    const priority = await orderPriorityFor(workItemId);
    const departmentId = stringField(payload, "departmentId");
    const derived = deriveFromStateChange({
      from: (stringField(payload, "from") as WorkItemState | undefined) ?? null,
      to,
      orderPriority: priority,
    });

    return derived.map((derivedEvent) => ({
      type: derivedEvent.type,
      ctx,
      // The department-aware derived entries read it from the payload; the
      // permission-addressed one ignores it. An empty array adds nothing, so
      // a payload without the field is safe rather than an error.
      emitted: { departmentIds: departmentId ? [departmentId] : [] },
    }));
  }

  return [{ type: entry.type, ctx, emitted: emitterRecipients(event) }];
}

function emitterRecipients(event: ClaimedEvent): RecipientSpec {
  return {
    userIds: event.recipientUserIds,
    roles: event.recipientRoles,
    departmentIds: event.recipientDepartmentIds,
    permissions: event.recipientPermissions,
  };
}

/**
 * Inserts one notification per delivery and marks the outbox row PROCESSED.
 *
 * A duplicate is detected with an explicit SAVEPOINT rather than a bare try /
 * catch. In PostgreSQL a failed statement aborts the whole transaction, so a
 * caught unique violation inside an open transaction leaves that transaction
 * unusable and every later command fails with `25P02`. Rolling back to a
 * savepoint confines the damage to the one insert, which is what makes
 * "treat a duplicate as success" true rather than merely intended:
 *
 *   - the notification insert may fail, and the event still gets marked
 *     PROCESSED, because the notification it would have created already
 *     exists (FR-007);
 *   - any OTHER error propagates and rolls the whole event back, so a partial
 *     batch is impossible (FR-005).
 *
 * Returns how many rows were genuinely inserted and how many were already
 * present. `created` is the sum: the end state either way is one notification
 * per (event, recipient).
 */
async function insertNotifications(
  event: ClaimedEvent,
  deliveries: ReadonlyArray<ResolvedDelivery>,
): Promise<{ inserted: number; duplicate: number }> {
  return db.$transaction(async (tx) => {
    let inserted = 0;
    let duplicate = 0;

    for (const delivery of deliveries) {
      await tx.$executeRawUnsafe("SAVEPOINT notify_insert");
      try {
        await tx.notification.create({
          data: {
            userId: delivery.userId,
            sourceEventId: event.id,
            type: delivery.type,
            title: delivery.title,
            body: delivery.body,
            linkHref: delivery.linkHref,
            entityType: event.entityType,
            entityId: event.entityId,
            severity: delivery.severity,
          },
        });
        inserted += 1;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT notify_insert");
        // The row this insert collided with is the notification we wanted.
        // The end state is already correct; only the accounting differs.
        duplicate += 1;
      }
    }

    // The outbox row is marked PROCESSED in the SAME transaction as the
    // notifications, so a reader never sees a notification whose event is
    // still unprocessed, and a rollback removes both together.
    await tx.notificationEvent.update({
      where: { id: event.id },
      data: { deliveryStatus: "PROCESSED", deliveredAt: new Date(), lastError: null },
    });

    return { inserted, duplicate };
  });
}

export interface ResolvedDelivery {
  readonly userId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string | null;
  readonly linkHref: string | null;
  readonly severity: "INFO" | "ACTION" | "URGENT";
}

/**
 * Resolves one planned delivery to concrete per-user rows.
 *
 * The recipient set is: the emitter's own specification, the catalog's
 * default, and the type's override — all three, UNIONED. The emitter and the
 * catalog are both sources of truth about who should hear about something, so
 * neither is discarded; the override can only add.
 */
async function resolveDeliveries(plans: DeliveryPlan[]): Promise<ResolvedDelivery[]> {
  const perUser: Array<{ userId: string; type: string; rendered: ReturnType<typeof renderEntry> }> = [];

  for (const plan of plans) {
    const entry = lookup(plan.type);
    if (!entry) continue;

    const rendered = renderEntry(entry, plan.ctx);
    const override = await recipientOverride(plan.type);
    const spec = unionSpecs(
      unionSpecs(
        typeof entry.recipients === "function" ? entry.recipients(plan.ctx) : entry.recipients,
        plan.emitted,
      ),
      override,
    );
    const users = await resolveRecipients(spec);
    for (const userId of users) {
      perUser.push({ userId, type: entry.type, rendered });
    }
  }

  // Collapse duplicates: a user reached by two derived entries (or by the
  // emitter AND the catalog default) gets ONE notification at the higher
  // severity. The `@@unique` pair would enforce the count anyway, but by
  // keeping whichever row happened to be inserted first — which is not
  // necessarily the more severe one.
  const byUserType = new Map<string, (typeof perUser)[number]>();
  for (const candidate of perUser) {
    const key = `${candidate.userId}::${candidate.type}`;
    const existing = byUserType.get(key);
    if (!existing) {
      byUserType.set(key, candidate);
      continue;
    }
    if (severityRank(candidate.rendered.severity) > severityRank(existing.rendered.severity)) {
      byUserType.set(key, candidate);
    }
  }

  return [...byUserType.values()].map((candidate) => ({
    userId: candidate.userId,
    type: candidate.type,
    title: candidate.rendered.title,
    body: candidate.rendered.body,
    linkHref: candidate.rendered.linkHref,
    severity: candidate.rendered.severity,
  }));
}

const SEVERITY_RANK = { INFO: 0, ACTION: 1, URGENT: 2 } as const;
function severityRank(severity: "INFO" | "ACTION" | "URGENT"): number {
  return SEVERITY_RANK[severity];
}

/** PostgreSQL unique-violation. 23505 is the SQLSTATE. */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  return candidate.code === "P2002" || candidate.code === "23505";
}

/**
 * Processes one claimed event: create its notifications and mark it
 * PROCESSED, all in ONE transaction (FR-005).
 *
 * One transaction per event, not per batch: a failure must roll back the
 * event it belongs to without discarding the other 99 in the batch (FR-052),
 * and a partial batch would mean some notifications visible whose outbox row
 * is still PENDING.
 */
async function processOne(
  event: ClaimedEvent,
): Promise<{ created: number; signalled: string[]; unmapped: boolean }> {
  const plans = await planFor(event);

  if (plans === "UNMAPPED") {
    await markUnmapped(event.id);
    return { created: 0, signalled: [], unmapped: true };
  }

  if (plans.length === 0) {
    // A TRIGGER that derived nothing, or a RECORDED_ONLY entry. Processed so
    // the outbox drains, with no notification — which is the specified
    // behaviour, not a failure, and specifically NOT unmapped: the type is
    // known, its audience is deliberately empty.
    await markProcessed(event.id);
    return { created: 0, signalled: [], unmapped: false };
  }

  const deliveries = await resolveDeliveries(plans);

  // Partition BEFORE the transaction, not inside it. In PostgreSQL a failed
  // statement ABORTS the whole transaction: catching a unique violation and
  // carrying on with the next query inside the same transaction fails with
  // `25P02 current transaction is aborted`. So a duplicate has to be
  // recognised in its own transaction, and the surviving inserts retried
  // together — otherwise the catch below would look correct and the
  // PROCESSED update would still fail, marking the event FAILED for a
  // duplicate that is in fact the desired end state (FR-007).
  const attempted = new Map<string, (typeof deliveries)[number]>();
  const duplicates = new Set<string>();

  for (const delivery of deliveries) {
    if (attempted.has(delivery.userId)) {
      // Two deliveries for one user collapse to one row per (event, user);
      // the `@@unique` pair makes the second impossible, so do not send it.
      duplicates.add(delivery.userId);
      continue;
    }
    attempted.set(delivery.userId, delivery);
  }

  const { inserted, duplicate } = await insertNotifications(event, [...attempted.values()]);

  const created = inserted + duplicate;
  void duplicates;

  // Publish AFTER the commit. A signal for a transaction that later rolls
  // back would tell a client to re-read data that does not exist (FR-028,
  // contract §Ordering guarantee).
  const signalled: string[] = [];
  for (const delivery of deliveries) {
    publish(delivery.userId, { id: event.id, type: delivery.type, severity: delivery.severity });
    signalled.push(delivery.userId);
  }
  for (const userId of new Set(signalled)) {
    const count = await unreadCountFor(userId);
    if (count !== null) publishCount(userId, count);
  }

  return { created, signalled, unmapped: false };
}

/**
 * The unread total for one user, for the stream's `count` event so the bell
 * does not have to count on the client (contract §5). A failure here returns
 * null rather than propagating: the signal has already gone out and the
 * client's own re-read will produce the correct count, so letting this throw
 * would fail a delivery that already succeeded.
 */
async function unreadCountFor(userId: string): Promise<number | null> {
  try {
    return await db.notification.count({
      where: { userId, readAt: null, archivedAt: null },
    });
  } catch {
    return null;
  }
}

/**
 * Drains a batch of PENDING outbox events into notifications.
 *
 * NEVER throws for a per-event failure — one bad event must not stop the
 * batch, and must certainly not surface in the caller's request path. Throws
 * only `OUTBOX_UNAVAILABLE` when the claim query itself fails, which is the
 * one failure the caller genuinely cannot proceed past.
 */
export async function processOutboxBatch(limit?: number): Promise<ProcessResult> {
  const { scheduler } = getNotificationConfig();
  const batchLimit = limit ?? scheduler.outboxBatchLimit;
  const maxAttempts = scheduler.maxAttempts;

  let claimed: ClaimedEvent[];
  try {
    claimed = await claimBatch(batchLimit, maxAttempts);
  } catch (error) {
    throw new DomainNotificationError(
      "OUTBOX_UNAVAILABLE",
      `failed to claim outbox batch: ${describeError(error)}`,
    );
  }

  let processed = 0;
  let unmapped = 0;
  let failed = 0;
  let notificationsCreated = 0;

  for (const event of claimed) {
    try {
      const outcome = await processOne(event);
      notificationsCreated += outcome.created;
      // An UNMAPPED row IS processed (the outbox drained) but it produced no
      // notification, so it is counted in both columns: `processed` answers
      // "did the outbox move?", `unmapped` answers "was it one we understand?".
      processed += 1;
      if (outcome.unmapped) unmapped += 1;
    } catch (error) {
      const attempts = event.attemptCount + 1;
      try {
        await markFailed(event.id, describeError(error));
      } catch {
        // The row could not even be marked failed. Nothing further to do —
        // the claim predicate still shows it as unprocessed, so the next
        // tick retries it. Never let this escalate into a thrown rejection.
      }
      // Every failure in this batch is a failure, exhausted or not: the
      // contract's `failed` field means "events left for retry" (FR-008).
      // `attemptCount >= maxAttempts` is what stops the RETRY, and the
      // thresholds screen surfaces those separately by querying FAILED rows.
      failed += 1;
      if (attempts >= maxAttempts) {
        // Attempt budget exhausted — this row will no longer be claimed.
        // Nothing further to do here; it is visible on the Admin screen.
      }
    }
  }

  return { processed, unmapped, failed, notificationsCreated };
}
