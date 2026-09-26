// The delay scheduler — contract §startDelayScheduler / stopDelayScheduler.
//
// An in-process interval behind a PERSISTED LEASE. Two independent mechanisms
// guard it, and neither alone is sufficient (research.md §Decision: both
// idempotency layers are required):
//
//   1. The lease stops the NORMAL case — two instances during a rolling
//      deploy, or a restart racing the old process. A second instance skips
//      its tick silently.
//   2. `@@unique([workItemId, phase, breachSequence])` stops the ABNORMAL
//      case — a lease that expired mid-run (long GC, a stalled query, a
//      suspended laptop), a manual re-trigger, or a plain bug. A design that
//      relied on the lease alone fails silently under exactly the conditions a
//      small shop hits most: a server that reboots, a laptop that sleeps, a
//      process killed mid-tick.
//
// Detection is INERT (FR-068, constitution II). This module writes exactly
// four tables — Notification, DelayBreach, SchedulerRun, SchedulerLease — and
// never a Work Item state, a PricingStatus, or any business gate.

import { hostname } from "node:os";
import type { WorkItemState } from "~/server/core";
import { db } from "~/server/db";
import { getNotificationConfig } from "./config";
import type { DelayPhase } from "./config";
import { describeError } from "./errors";
import { PHASE_LABELS_AR } from "./delays";
import {
  deriveDelay,
  evaluateDelay,
  formatAge,
  isTerminalState,
  loadAgeInputs,
  thresholdRecipients,
  type DelayCandidate,
  type ThresholdRow,
} from "./delays";
import { lookup, renderEntry } from "./catalog";
import { resolveRecipients } from "./recipients";
import { publish, publishCount } from "./stream";
import { thresholdMap } from "./thresholds";

const LEASE_ID = "delay-scheduler";

/** This process's identity. Stands in for an `actorId` the tick cannot have. */
export function processOwnerId(): string {
  return `${hostname()}:${process.pid}`;
}

export interface DelayTickResult {
  /** False when another instance held the lease and this tick was skipped. */
  readonly ran: boolean;
  readonly runId: string | null;
  readonly evaluated: number;
  readonly flagged: number;
  readonly alerted: number;
  readonly escalated: number;
}

const EMPTY: DelayTickResult = {
  ran: false,
  runId: null,
  evaluated: 0,
  flagged: 0,
  alerted: 0,
  escalated: 0,
};

/**
 * Acquires the lease, or returns false.
 *
 * ONE conditional UPDATE, so two instances racing produce exactly one winner
 * with no advisory lock and no read-then-write window. `expiresAt < now` is
 * what makes a lease held by a dead process reclaimable — without that, a
 * machine that lost power mid-tick would block every future tick until
 * someone edited the row by hand.
 */
async function acquireLease(ownerId: string, leaseSeconds: number): Promise<boolean> {
  const now = new Date();
  const { count } = await db.schedulerLease.updateMany({
    where: { id: LEASE_ID, OR: [{ expiresAt: { lt: now } }, { ownerId }] },
    data: { ownerId, acquiredAt: now, expiresAt: new Date(now.getTime() + leaseSeconds * 1000) },
  });
  return count > 0;
}

async function releaseLease(ownerId: string): Promise<void> {
  // Expire rather than delete: the row must always exist so the next
  // acquisition is an UPDATE, not an INSERT that could race.
  await db.schedulerLease.updateMany({
    where: { id: LEASE_ID, ownerId },
    data: { expiresAt: new Date(0) },
  });
}

/** Every non-terminal Work Item with the fields the derivation needs. */
async function loadCandidates(): Promise<DelayCandidate[]> {
  const workItems = await db.workItem.findMany({
    where: { state: { notIn: ["DELIVERED", "COMPLETED", "CANCELLED"] } },
    select: {
      id: true,
      state: true,
      requiresDesign: true,
      createdAt: true,
      departmentId: true,
      department: { select: { name: true } },
      order: {
        select: { id: true, number: true, priority: true, customer: { select: { name: true } } },
      },
      productType: { select: { name: true } },
    },
  });

  return workItems.map((workItem) => ({
    workItemId: workItem.id,
    orderId: workItem.order.id,
    orderNumber: workItem.order.number,
    customerName: workItem.order.customer.name,
    productTypeName: workItem.productType?.name ?? null,
    state: workItem.state as WorkItemState,
    priority: workItem.order.priority,
    createdAt: workItem.createdAt,
    departmentId: workItem.departmentId,
    departmentName: workItem.department?.name ?? null,
    requiresDesign: workItem.requiresDesign,
  }));
}

/**
 * The sequence number for a NEW breach of (workItem, phase).
 *
 * A Work Item that leaves a delayed phase and returns is a genuinely new
 * breach and must alert again (FR-044), so the number is one past the highest
 * already recorded for that pair — not a count, and not "1 unless one
 * exists". The old breach row is retained.
 */
async function nextSequence(workItemId: string, phase: DelayPhase): Promise<number> {
  const latest = await db.delayBreach.findFirst({
    where: { workItemId, phase },
    orderBy: { breachSequence: "desc" },
    select: { breachSequence: true },
  });
  return (latest?.breachSequence ?? 0) + 1;
}

/** The catalog type a phase's breach alerts under. FR-037: pricing is special. */
function alertTypeFor(phase: DelayPhase): string {
  return phase === "PRICING" ? "work_item.pricing_delayed" : "work_item.phase_delayed";
}

/** PostgreSQL unique violation (Prisma P2002 / SQLSTATE 23505). */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2002" || code === "23505";
}

/**
 * Creates the breach row, its outbox row, and its notifications in ONE
 * transaction (FR-042/043).
 *
 * Returns `created: false` when the insert hit the unique triple — the
 * "another tick got here first" case, and the ONLY thing standing between a
 * race and a duplicate alert. The catch is the defence; the constraint is what
 * makes catching sufficient.
 *
 * The outbox row is written already-PROCESSED on purpose. The scheduler
 * delivers directly rather than queueing for `processOutboxBatch`, so leaving
 * the row PENDING would make the next processor tick pick it up and create a
 * SECOND set of notifications for the same breach — the precise duplication
 * this whole feature is built to prevent. Marking it processed keeps the row
 * as the FR-063 delivery record while making it invisible to the processor.
 */
async function recordBreach(params: {
  workItemId: string;
  phase: DelayPhase;
  threshold: ThresholdRow;
  waitingSince: Date;
  waitingAgeMinutes: number;
  now: Date;
}): Promise<{ created: boolean; notified: string[]; eventId: string | null }> {
  const { workItemId, phase, threshold, waitingAgeMinutes, now } = params;
  const sequence = await nextSequence(workItemId, phase);
  const type = alertTypeFor(phase);
  const age = formatAge(waitingAgeMinutes);
  const notified: string[] = [];

  try {
    const eventId = await db.$transaction(async (tx) => {
      await tx.delayBreach.create({
        data: {
          workItemId,
          phase,
          breachSequence: sequence,
          thresholdMinutes: threshold.thresholdMinutes ?? 0,
          notifiedAt: now,
          detectedAt: now,
        },
      });

      const recipients = thresholdRecipients(threshold);
      const event = await tx.notificationEvent.create({
        data: {
          type,
          entityType: "WorkItem",
          entityId: workItemId,
          recipientRoles: [...recipients.roles],
          recipientDepartmentIds: [...recipients.departmentIds],
          recipientPermissions: [...recipients.permissions],
          payload: {
            phase,
            age,
            waitingAgeMinutes,
            breachSequence: sequence,
            thresholdMinutes: threshold.thresholdMinutes,
          },
          // Delivered inline by the scheduler; never claimed by the processor.
          deliveredAt: now,
          deliveryStatus: "PROCESSED",
        },
        select: { id: true },
      });

      const entry = lookup(type);
      if (!entry) return event.id;

      const rendered = renderEntry(entry, {
        payload: {
          phase,
          phaseLabel: PHASE_LABELS_AR[phase],
          age,
          waitingAgeMinutes,
        },
        entityId: workItemId,
        workItemId,
      });

      const users = await resolveRecipients(recipients, tx as never);
      for (const userId of users) {
        await tx.notification.create({
          data: {
            userId,
            sourceEventId: event.id,
            type,
            title: rendered.title,
            // The catalog body is used when it renders; otherwise the shared
            // "{age} + phase" phrasing, so the age still reaches the employee
            // rather than an alert with no detail.
            body: rendered.body ?? `الانتظار: ${age} — ${PHASE_LABELS_AR[phase]}`,
            linkHref: rendered.linkHref,
            entityType: "WorkItem",
            entityId: workItemId,
            severity: rendered.severity,
          },
        });
        notified.push(userId);
      }

      return event.id;
    });

    return { created: true, notified, eventId };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { created: false, notified: [], eventId: null };
    }
    throw error;
  }
}

/**
 * One delay-detection tick.
 *
 * Never throws (FR-052): every failure is recorded on the `SchedulerRun` row
 * and swallowed, because a tick that throws into the Next.js request path or
 * crashes the process would take the whole shop's app down for a feature that
 * is only a report.
 */
export async function runDelayTick(): Promise<DelayTickResult> {
  const { scheduler } = getNotificationConfig();
  const ownerId = processOwnerId();

  if (!(await acquireLease(ownerId, scheduler.leaseSeconds))) {
    // Another instance is running. Skipping silently is correct: reporting an
    // error here would page an Admin for something that is working.
    return EMPTY;
  }

  const run = await db.schedulerRun.create({
    data: { ownerId, outcome: "RUNNING" },
    select: { id: true },
  });

  let evaluated = 0;
  let flagged = 0;
  let alerted = 0;
  let escalated = 0;

  try {
    const now = new Date();
    const [candidates, thresholds] = await Promise.all([loadCandidates(), thresholdMap()]);
    evaluated = candidates.length;

    const ageInputs = await loadAgeInputs(
      candidates.map((c) => ({
        id: c.workItemId,
        state: c.state,
        requiresDesign: c.requiresDesign,
      })),
    );

    const signalled = new Set<string>();

    for (const candidate of candidates) {
      if (isTerminalState(candidate.state)) continue;
      const input = ageInputs.get(candidate.workItemId);
      if (!input) continue;

      // The SAME pure derivation the query uses, so the tick's alert and the
      // delayed list can never disagree about what "late" means.
      const derived = deriveDelay({ ...input, now });
      const outcome = evaluateDelay(derived, thresholds);
      if (outcome.kind === "NONE") continue;

      const threshold = thresholds.get(outcome.phase);
      if (!threshold || threshold.thresholdMinutes === null) continue;

      const breach = await recordBreach({
        workItemId: candidate.workItemId,
        phase: outcome.phase,
        threshold,
        waitingSince: outcome.waitingSince,
        waitingAgeMinutes: outcome.waitingAgeMinutes,
        now,
      });

      if (breach.created) {
        flagged += 1;
        alerted += breach.notified.length;
        for (const userId of breach.notified) signalled.add(userId);
      }
    }

    // Publish after every breach is committed, so a signal never precedes the
    // row it refers to (FR-028's ordering guarantee).
    for (const userId of signalled) {
      const count = await db.notification
        .count({ where: { userId, readAt: null, archivedAt: null } })
        .catch(() => null);
      if (count === null) continue;
      publish(userId, { id: "", type: "work_item.phase_delayed", severity: "ACTION" });
      publishCount(userId, count);
    }

    await db.schedulerRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        outcome: "OK",
        evaluated,
        flagged,
        alerted,
        escalated,
      },
    });

    return { ran: true, runId: run.id, evaluated, flagged, alerted, escalated };
  } catch (error) {
    await db.schedulerRun
      .update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          outcome: "ERROR",
          evaluated,
          flagged,
          alerted,
          escalated,
          error: describeError(error).slice(0, 2000),
        },
      })
      .catch(() => {
        // Even recording the failure failed. Swallow: there is no caller to
        // inform and no recovery action that would help.
      });

    return { ran: true, runId: run.id, evaluated, flagged, alerted, escalated };
  }
}

let interval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the interval. Idempotent: a second call does NOT create a second
 * interval (this is the in-process half of the exactly-once guarantee,
 * FR-050). Runs one tick IMMEDIATELY on start, so a window missed during
 * downtime is evaluated rather than skipped (FR-051) — a shop that was closed
 * all weekend must see Monday morning's overnight staleness, not wait for the
 * first interval to elapse.
 */
export function startDelayScheduler(opts?: { intervalMinutes?: number }): void {
  if (interval) return;

  const minutes = opts?.intervalMinutes ?? getNotificationConfig().scheduler.intervalMinutes;
  interval = setInterval(() => {
    void runDelayTick();
  }, minutes * 60_000);

  void runDelayTick();
}

/**
 * Stops the interval and RELEASES this process's lease, so
 * `schedulerStatus()` immediately reports stopped and another instance (or a
 * later restart) can acquire it.
 *
 * Reversible and non-destructive: no `DelayBreach` or `Notification` is
 * removed, so alerts resume on the next start with the existing breach rows
 * intact and a stop/start cycle still yields exactly one alert per breach
 * (FR-054, SC-003). That is what makes the Admin-facing stop control safe to
 * expose at all.
 */
export function stopDelayScheduler(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  void releaseLease(processOwnerId());
}

/** True when this process holds a live interval. */
export function isSchedulerRunning(): boolean {
  return interval !== null;
}
