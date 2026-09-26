// NotificationConfig — 053-notifications (constitution VI).
//
// Reads resolve to `config/053-notifications.yaml`, the same FileConfig /
// YAML pattern 052-finance and 050-files use. The YAML is the SEED for the
// `DelayThreshold` table (the migration inserts the same five numbers) and
// the live source for the scheduler/stream constants, which are deliberately
// NOT Admin-editable: a shop LAN does not need them tuned, and every extra
// knob is one more thing to get wrong.
//
// Thresholds themselves are never read from here at query or tick time —
// they are read from the table, so an Admin's change takes effect on the next
// tick with no restart and no deploy (FR-045).

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { DomainNotificationError } from "./errors";

/** The five measured phases, in the order the Admin screen lists them. */
export const DELAY_PHASES = [
  "DESIGN",
  "REVIEW",
  "PRICING",
  "PRODUCTION",
  "COLLECTION",
] as const;

export type DelayPhase = (typeof DELAY_PHASES)[number];

export function isDelayPhase(value: string): value is DelayPhase {
  return (DELAY_PHASES as readonly string[]).includes(value);
}

/** Arabic phase names, used by the delayed list, the Admin screen, and the
 *  scheduler's notification body — one source so a phase never renders two
 *  ways (SC-012). */
export const PHASE_LABELS_AR: Record<DelayPhase, string> = {
  DESIGN: "التصميم",
  REVIEW: "المراجعة",
  PRICING: "التسعير",
  PRODUCTION: "الإنتاج",
  COLLECTION: "الاستلام",
};

export interface NotificationConfigData {
  /** Seed thresholds in minutes; `null` = phase disabled. */
  readonly thresholds: Record<DelayPhase, number | null>;
  readonly scheduler: {
    readonly intervalMinutes: number;
    readonly leaseSeconds: number;
    readonly outboxBatchLimit: number;
    readonly maxAttempts: number;
    readonly processorIntervalMs: number;
  };
  readonly stream: {
    readonly pingSeconds: number;
    readonly pollSeconds: number;
    readonly maxConnections: number;
  };
}

const FALLBACK: NotificationConfigData = {
  thresholds: {
    DESIGN: 240,
    REVIEW: 60,
    PRICING: 120,
    PRODUCTION: 480,
    COLLECTION: 1440,
  },
  scheduler: {
    intervalMinutes: 5,
    leaseSeconds: 120,
    outboxBatchLimit: 100,
    maxAttempts: 5,
    processorIntervalMs: 500,
  },
  stream: { pingSeconds: 25, pollSeconds: 15, maxConnections: 500 },
};

let cache: NotificationConfigData | null = null;

function requirePositiveInt(value: unknown, field: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
    throw new Error(`Config: ${field} must be a positive integer`);
  }
  return n;
}

function loadYamlConfig(): NotificationConfigData {
  const resolvedPath =
    process.env.NOTIFICATIONS_CONFIG_PATH ??
    path.resolve(process.cwd(), "config", "053-notifications.yaml");

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const parsed = yaml.parse(fs.readFileSync(resolvedPath, "utf-8")) as {
    thresholds?: Record<string, unknown>;
    scheduler?: Record<string, unknown>;
    stream?: Record<string, unknown>;
  } | null;

  if (!parsed) {
    throw new Error(`Config: ${resolvedPath} is empty`);
  }

  const thresholds = { ...FALLBACK.thresholds };
  for (const rawKey of Object.keys(parsed.thresholds ?? {})) {
    if (!isDelayPhase(rawKey)) {
      throw new Error(`Config: unknown delay phase "${rawKey}"`);
    }
    const value = parsed.thresholds![rawKey];
    if (value === null) {
      thresholds[rawKey] = null;
    } else {
      thresholds[rawKey] = requirePositiveInt(value, `thresholds.${rawKey}`);
    }
  }

  const scheduler = { ...FALLBACK.scheduler, ...(parsed.scheduler ?? {}) };
  const stream = { ...FALLBACK.stream, ...(parsed.stream ?? {}) };

  return {
    thresholds,
    scheduler: {
      intervalMinutes: requirePositiveInt(scheduler.intervalMinutes, "scheduler.intervalMinutes"),
      leaseSeconds: requirePositiveInt(scheduler.leaseSeconds, "scheduler.leaseSeconds"),
      outboxBatchLimit: requirePositiveInt(
        scheduler.outboxBatchLimit,
        "scheduler.outboxBatchLimit",
      ),
      maxAttempts: requirePositiveInt(scheduler.maxAttempts, "scheduler.maxAttempts"),
      processorIntervalMs: requirePositiveInt(
        // Older config files predate this field; the fallback keeps them
        // loadable rather than crashing the server at boot.
        (scheduler as { processorIntervalMs?: number }).processorIntervalMs ??
          FALLBACK.scheduler.processorIntervalMs,
        "scheduler.processorIntervalMs",
      ),
    },
    stream: {
      pingSeconds: requirePositiveInt(stream.pingSeconds, "stream.pingSeconds"),
      pollSeconds: requirePositiveInt(stream.pollSeconds, "stream.pollSeconds"),
      maxConnections: requirePositiveInt(stream.maxConnections, "stream.maxConnections"),
    },
  };
}

/**
 * The parsed config, loaded once per process. A malformed file is a hard
 * startup failure rather than a silent fallback — a shop whose thresholds
 * silently reverted to defaults would alert on the wrong numbers without
 * anyone noticing, which is worse than a boot that says why.
 */
export function getNotificationConfig(): NotificationConfigData {
  cache ??= loadYamlConfig();
  return cache;
}

/** Test seam: drops the memoized parse so a changed file is re-read. */
export function resetNotificationConfigCache(): void {
  cache = null;
}

/**
 * Seed thresholds for the migration's five `DelayThreshold` rows, paired with
 * the recipient lists the Clarification settled on. Returned as data so the
 * migration (SQL) and any seeder (TS) cannot drift apart.
 */
export function seedThresholds(): Array<{
  phase: DelayPhase;
  thresholdMinutes: number | null;
  alertRoles: string[];
  alertPermissions: string[];
  alertDepartmentIds: string[];
}> {
  const { thresholds } = getNotificationConfig();
  return DELAY_PHASES.map((phase) => {
    const base = {
      phase,
      thresholdMinutes: thresholds[phase],
      // Department ids are resolved by the seeder, not here: a role/permission
      // seed needs no lookup, and a department seed must not invent an id.
      alertDepartmentIds: [] as string[],
    };
    switch (phase) {
      case "DESIGN":
        return { ...base, alertRoles: ["HEAD_DESIGNER"], alertPermissions: ["design.work"] };
      case "REVIEW":
        return { ...base, alertRoles: ["HEAD_DESIGNER"], alertPermissions: ["design.review"] };
      case "PRICING":
        return {
          ...base,
          alertRoles: ["ACCOUNTING", "ADMIN_OWNER"],
          alertPermissions: ["pricing.set_variable"],
        };
      case "PRODUCTION":
        return {
          ...base,
          alertRoles: ["PRODUCTION_OPERATOR", "HEAD_DESIGNER"],
          alertPermissions: ["production.operate"],
        };
      case "COLLECTION":
        return {
          ...base,
          alertRoles: ["PRINT_RECEPTION_DELIVERY", "RECEPTION"],
          alertPermissions: ["collection.receive"],
        };
    }
  });
}

/** Maps a validation failure onto the closest declared code. */
export function invalidThreshold(message: string): DomainNotificationError {
  return new DomainNotificationError("INVALID_THRESHOLD", message);
}
