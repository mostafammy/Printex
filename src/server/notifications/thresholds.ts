// Delay thresholds and scheduler observability — contract §delayThresholds.
//
// Thresholds are CONFIGURATION, not code (constitution VI): five rows an Admin
// edits through /admin/notifications, seeded by the migration, and read fresh
// on every tick and every query so a change takes effect with no restart and
// no deploy (FR-045).
//
// No new permission key: `admin.config` already exists in 001's frozen
// vocabulary and PRD §48 assigns "Configure notifications" to Admin/Owner.
// The outbox view reuses `audit.view` (contract §Permission mapping).

import { z } from "zod";
import type { Actor } from "~/server/auth";
import { ALL_PERMISSIONS, ALL_ROLE_KEYS, audit, authorize } from "~/server/auth";

import { db } from "~/server/db";
import { DELAY_PHASES, type DelayPhase } from "./config";
import { DomainNotificationError } from "./errors";
import { formatDuration } from "./delays";

export type { DelayPhase };
export { DELAY_PHASES };

export interface ThresholdView {
  readonly phase: DelayPhase;
  /** null = the phase is disabled and never alerts. */
  readonly thresholdMinutes: number | null;
  /** `4h`, `30m`, `1h30m` — the Admin screen's input representation. */
  readonly thresholdInput: string;
  readonly alertRoles: readonly string[];
  readonly alertPermissions: readonly string[];
  readonly alertDepartmentIds: readonly string[];
  readonly escalationMinutes: number | null;
  readonly escalationInput: string;
  readonly updatedAt: string;
  readonly updatedById: string | null;
}

export interface ThresholdInput {
  readonly phase: DelayPhase;
  readonly thresholdMinutes: number | null;
  readonly alertRoles?: readonly string[];
  readonly alertPermissions?: readonly string[];
  readonly alertDepartmentIds?: readonly string[];
  readonly escalationMinutes?: number | null;
  /** REQUIRED by 053's audit policy; validated BEFORE `audit.record` (FR-061). */
  readonly reason: string;
}

const thresholdInputSchema = z.object({
  phase: z.enum(DELAY_PHASES),
  thresholdMinutes: z.number().int().positive().nullable(),
  alertRoles: z.array(z.string().min(1)).max(50).optional(),
  alertPermissions: z.array(z.string().min(1)).max(50).optional(),
  alertDepartmentIds: z.array(z.string().min(1)).max(50).optional(),
  escalationMinutes: z.number().int().positive().nullable().optional(),
  reason: z.string().trim().min(1, "السبب مطلوب"),
});

/**
 * All five thresholds, one row per phase, in display order.
 *
 * A phase with no row (possible if a migration is replayed against a database
 * where the seed was skipped) comes back DISABLED rather than missing, so the
 * Admin screen always shows five rows and a shop is never silently un-alerted
 * on a phase it believes is configured.
 */
export async function read(): Promise<ThresholdView[]> {
  const rows = await db.delayThreshold.findMany();
  const byPhase = new Map(rows.map((row) => [row.phase, row]));

  return DELAY_PHASES.map((phase) => {
    const row = byPhase.get(phase);
    return {
      phase,
      thresholdMinutes: row?.thresholdMinutes ?? null,
      thresholdInput: formatDuration(row?.thresholdMinutes ?? null),
      alertRoles: row?.alertRoles ?? [],
      alertPermissions: row?.alertPermissions ?? [],
      alertDepartmentIds: row?.alertDepartmentIds ?? [],
      escalationMinutes: row?.escalationMinutes ?? null,
      escalationInput: formatDuration(row?.escalationMinutes ?? null),
      updatedAt: row?.updatedAt.toISOString() ?? "",
      updatedById: row?.updatedById ?? null,
    };
  });
}

/** The thresholds as the scheduler's own lookup map. Fresh on every tick. */
export async function thresholdMap(): Promise<
  Map<DelayPhase, {
    phase: DelayPhase;
    thresholdMinutes: number | null;
    alertRoles: readonly string[];
    alertPermissions: readonly string[];
    alertDepartmentIds: readonly string[];
  }>
> {
  const rows = await db.delayThreshold.findMany();
  return new Map(
    rows.map((row) => [
      row.phase,
      {
        phase: row.phase,
        thresholdMinutes: row.thresholdMinutes,
        alertRoles: row.alertRoles,
        alertPermissions: row.alertPermissions,
        alertDepartmentIds: row.alertDepartmentIds,
      },
    ]),
  );
}

function toView(row: {
  phase: DelayPhase;
  thresholdMinutes: number | null;
  alertRoles: string[];
  alertPermissions: string[];
  alertDepartmentIds: string[];
  escalationMinutes: number | null;
  updatedAt: Date;
  updatedById: string | null;
}): ThresholdView {
  return {
    phase: row.phase,
    thresholdMinutes: row.thresholdMinutes,
    thresholdInput: formatDuration(row.thresholdMinutes),
    alertRoles: row.alertRoles,
    alertPermissions: row.alertPermissions,
    alertDepartmentIds: row.alertDepartmentIds,
    escalationMinutes: row.escalationMinutes,
    escalationInput: formatDuration(row.escalationMinutes),
    updatedAt: row.updatedAt.toISOString(),
    updatedById: row.updatedById,
  };
}

async function assertKnownDepartments(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await db.department.findMany({
    where: { id: { in: [...ids] }, isActive: true },
    select: { id: true },
  });
  const known = new Set(found.map((d) => d.id));
  const unknown = ids.find((id) => !known.has(id));
  if (unknown !== undefined) {
    throw new DomainNotificationError("UNKNOWN_DEPARTMENT", `unknown department: ${unknown}`);
  }
}

/**
 * Updates one phase's threshold and its recipients.
 *
 * `admin.config` → validate → upsert + `notification.threshold_updated` with
 * the REQUIRED reason, in ONE transaction. A refused write stores nothing and
 * writes no audit event (FR-062) — every validation below runs BEFORE the
 * transaction opens, not inside it.
 */
export async function update(actor: Actor, input: ThresholdInput): Promise<ThresholdView> {
  authorize(actor, "admin.config");

  const parsed = thresholdInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    if (field === "thresholdMinutes") {
      throw new DomainNotificationError("INVALID_THRESHOLD", "المدة يجب أن تكون أكبر من صفر");
    }
    if (field === "escalationMinutes") {
      throw new DomainNotificationError("INVALID_ESCALATION", "مدة التصعيد غير صالحة");
    }
    if (field === "reason") {
      throw new DomainNotificationError("EMPTY_REASON", "السبب مطلوب");
    }
    throw new DomainNotificationError("VALIDATION", issue?.message ?? "invalid threshold");
  }

  const data = parsed.data;

  // FR-047's rule: an escalation tier must sit strictly above the threshold,
  // or "escalate" would fire the instant the base alert does and mean nothing.
  if (data.escalationMinutes !== null && data.escalationMinutes !== undefined) {
    if (data.thresholdMinutes === null) {
      throw new DomainNotificationError(
        "INVALID_ESCALATION",
        "لا يمكن تعيين مدة تصعيد لمرحلة معطّلة",
      );
    }
    if (data.escalationMinutes <= data.thresholdMinutes) {
      throw new DomainNotificationError(
        "INVALID_ESCALATION",
        "مدة التصعيد يجب أن تكون أكبر من مدة التنبيه",
      );
    }
  }

  const knownRoles = new Set<string>(ALL_ROLE_KEYS);
  const unknownRole = (data.alertRoles ?? []).find((r) => !knownRoles.has(r));
  if (unknownRole !== undefined) {
    throw new DomainNotificationError("UNKNOWN_ROLE", `unknown role: ${unknownRole}`);
  }

  const knownPermissions = new Set<string>(ALL_PERMISSIONS);
  const unknownPermission = (data.alertPermissions ?? []).find((p) => !knownPermissions.has(p));
  if (unknownPermission !== undefined) {
    throw new DomainNotificationError(
      "UNKNOWN_PERMISSION",
      `unknown permission: ${unknownPermission}`,
    );
  }

  await assertKnownDepartments(data.alertDepartmentIds ?? []);

  const before = await db.delayThreshold.findUnique({ where: { phase: data.phase } });

  const row = await db.$transaction(async (tx) => {
    const saved = await tx.delayThreshold.upsert({
      where: { phase: data.phase },
      create: {
        phase: data.phase,
        thresholdMinutes: data.thresholdMinutes,
        alertRoles: [...(data.alertRoles ?? [])],
        alertPermissions: [...(data.alertPermissions ?? [])],
        alertDepartmentIds: [...(data.alertDepartmentIds ?? [])],
        escalationMinutes: data.escalationMinutes ?? null,
        updatedById: actor.userId,
      },
      update: {
        thresholdMinutes: data.thresholdMinutes,
        alertRoles: [...(data.alertRoles ?? [])],
        alertPermissions: [...(data.alertPermissions ?? [])],
        alertDepartmentIds: [...(data.alertDepartmentIds ?? [])],
        escalationMinutes: data.escalationMinutes ?? null,
        updatedById: actor.userId,
      },
    });

    await audit.record(tx, {
      action: "notification.threshold_updated",
      entityType: "DelayThreshold",
      entityId: data.phase,
      actorId: actor.userId,
      before: before
        ? {
            thresholdMinutes: before.thresholdMinutes,
            alertRoles: before.alertRoles,
            alertPermissions: before.alertPermissions,
            alertDepartmentIds: before.alertDepartmentIds,
            escalationMinutes: before.escalationMinutes,
          }
        : null,
      after: {
        thresholdMinutes: saved.thresholdMinutes,
        alertRoles: saved.alertRoles,
        alertPermissions: saved.alertPermissions,
        alertDepartmentIds: saved.alertDepartmentIds,
        escalationMinutes: saved.escalationMinutes,
      },
      reason: data.reason,
    });

    return saved;
  });

  return toView(row);
}

// --- scheduler observability -------------------------------------------------

export interface SchedulerRunView {
  readonly id: string;
  readonly ownerId: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly outcome: "RUNNING" | "OK" | "ERROR";
  readonly evaluated: number;
  readonly flagged: number;
  readonly alerted: number;
  readonly escalated: number;
  readonly error: string | null;
}

export interface SchedulerStatus {
  /** The lease is held and unexpired. */
  readonly running: boolean;
  readonly lastRun: SchedulerRunView | null;
  readonly leaseOwner: string | null;
  readonly nextRunAt: string | null;
  readonly intervalMinutes: number;
  /** Types seen in the outbox with no catalog entry (FR-019). */
  readonly unmappedTypes: ReadonlyArray<{ type: string; count: number; lastSeenAt: string }>;
  /** Events that exhausted their attempt budget (FR-008). */
  readonly failedTypes: ReadonlyArray<{ type: string; count: number; lastError: string | null }>;
}

function toRunView(row: {
  id: string;
  ownerId: string;
  startedAt: Date;
  finishedAt: Date | null;
  outcome: "RUNNING" | "OK" | "ERROR";
  evaluated: number;
  flagged: number;
  alerted: number;
  escalated: number;
  error: string | null;
}): SchedulerRunView {
  return {
    id: row.id,
    ownerId: row.ownerId,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    outcome: row.outcome,
    evaluated: row.evaluated,
    flagged: row.flagged,
    alerted: row.alerted,
    escalated: row.escalated,
    error: row.error,
  };
}

/**
 * "Are alerts actually running?" and "what have we never heard about?" —
 * both answerable without reading logs (FR-053, FR-019).
 *
 * Requires `admin.config`. The unmapped aggregation is a GROUP BY over the
 * outbox, not a per-type loop: a shop's outbox is the only thing that grows
 * here, and this screen must not degrade as it does.
 */
export async function schedulerStatus(actor: Actor): Promise<SchedulerStatus> {
  authorize(actor, "admin.config");
  const { getNotificationConfig } = await import("./config");
  const { intervalMinutes } = getNotificationConfig().scheduler;

  const now = new Date();
  const [lease, lastRun, unmappedGroups, failedGroups] = await Promise.all([
    db.schedulerLease.findUnique({ where: { id: "delay-scheduler" } }),
    db.schedulerRun.findFirst({ orderBy: { startedAt: "desc" } }),
    db.notificationEvent.groupBy({
      by: ["type", "createdAt"],
      where: { deliveryStatus: "UNMAPPED" },
      _count: { type: true },
      orderBy: { createdAt: "desc" },
    }),
    db.notificationEvent.groupBy({
      by: ["type", "lastError"],
      where: { deliveryStatus: "FAILED" },
      _count: { type: true },
    }),
  ]);

  const running = lease !== null && lease.expiresAt > now;
  const nextRunAt =
    lastRun && running ? new Date(lastRun.startedAt.getTime() + intervalMinutes * 60_000) : null;

  // `groupBy` groups by DISTINCT (type, createdAt) / (type, lastError), so a
  // type seen 50 times comes back as 50 rows. The Admin screen wants one row
  // per type with a total, and — for unmapped — the most recent sighting. The
  // raw groups are ordered by createdAt desc, so the first group for a type
  // IS the latest, and `lastSeenAt` reads the group's own timestamp.
  const unmappedByType = new Map<
    string,
    { type: string; count: number; lastSeenAt: string }
  >();
  for (const group of unmappedGroups) {
    const existing = unmappedByType.get(group.type);
    const row = {
      type: group.type,
      count: (existing?.count ?? 0) + group._count.type,
      lastSeenAt: group.createdAt.toISOString(),
    };
    unmappedByType.set(group.type, row);
  }

  const failedByType = new Map<
    string,
    { type: string; count: number; lastError: string | null }
  >();
  for (const group of failedGroups) {
    const existing = failedByType.get(group.type);
    failedByType.set(group.type, {
      type: group.type,
      count: (existing?.count ?? 0) + group._count.type,
      // Any one failure's message is enough to diagnose; the newest is not
      // tracked per type, and the raw rows remain in the outbox for detail.
      lastError: group.lastError,
    });
  }

  return {
    running,
    lastRun: lastRun ? toRunView(lastRun) : null,
    leaseOwner: running ? lease?.ownerId : null,
    nextRunAt: nextRunAt?.toISOString() ?? null,
    intervalMinutes,
    unmappedTypes: [...unmappedByType.values()],
    failedTypes: [...failedByType.values()],
  };
}
