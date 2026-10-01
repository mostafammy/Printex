// Demo data controls — the two admin buttons on /admin/health.
//
//   purge   clear operational data, keep the app usable (orders, work items,
//           payments, expenses, files, notifications, audit trail). Reference and
//           identity data survives, so no one gets logged out mid-demo.
//   reseed  purge, then reload the curated demo dataset.
//
// WHY THIS SPAWNS A CHILD PROCESS INSTEAD OF USING PRISMA
//
// The purge/seed SQL already exists and is battle-tested: `pnpm db:seed:demo`
// (scripts/demo-cleanup-and-seed.mjs) is what has been resetting the live demo
// database. Re-implementing it here would mean two copies of ~700 lines of seed
// fixtures and TRUNCATE lists, which drift. So this service runs that script
// with `--mode=` and parses its summary line back.
//
// Consequences, stated plainly rather than discovered later:
//   - The action blocks for the duration of the run (seconds to tens of seconds
//     against a remote pooler). It is deliberately a server action rather than an
//     API route so the caller is the authenticated admin and the request cannot
//     be replayed by anyone else.
//   - The script's TRUNCATE/INSERTs are not one transaction, so a mid-run failure
//     leaves the database partially seeded. It is idempotent — re-running it is
//     the fix — but it is not atomic.
//
// These are DEMO TOOLS. Constitution III ("Normal users MUST NOT hard-delete
// operational records", "audit events are append-only") governs business
// operation; this is an admin-only demo affordance and deliberately does not
// offer an archive path, because the demo goal is an empty board, not a hidden
// one. Everything here is gated on `admin.config` and writes an AuditEvent.

import { execFile } from "node:child_process";
import path from "node:path";
import { revalidatePath, revalidateTag } from "next/cache";
import { authorize, audit, type Actor } from "~/server/auth";
import { DB_HEALTH_CACHE_TAG } from "~/server/admin/health";
import { getBoardLiveHub } from "~/server/board";

/** Must stay in sync with SUMMARY_SENTINEL in scripts/demo-cleanup-and-seed.mjs. */
const SUMMARY_SENTINEL = "::PRINTEX-DEMO-SUMMARY::";

export type DemoAction = "purge" | "reseed";

export interface DemoRunResult {
  readonly action: DemoAction;
  readonly before: Record<string, number> | null;
  readonly after: Record<string, number>;
  readonly durationMs: number;
}

/**
 * Script failed, produced no summary, or took too long. `message` is already
 * safe to show an admin (it is script output, not a stack trace).
 */
export class DemoToolError extends Error {
  constructor(
    readonly code: "SCRIPT_FAILED" | "NO_SUMMARY" | "TIMEOUT",
    message: string,
  ) {
    super(message);
    this.name = "DemoToolError";
  }
}

// A remote Supabase pooler on a busy network; the default purge is a handful of
// statements, the reseed is several hundred inserts. Generous, but bounded so a
// wedged child process surfaces as an error instead of a hung request.
const TIMEOUT_MS = 180_000;

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "demo-cleanup-and-seed.mjs");

/** Extract and parse the machine-readable summary the script prints. */
export interface RawSummary {
  mode?: string;
  before?: Record<string, number> | null;
  after?: Record<string, number>;
  durationMs?: number;
}

// Exported for the unit test in tests/unit/demo-summary.test.ts, which pins the
// one piece of this path that can fail silently.
export function parseDemoSummary(stdout: string): DemoRunResult | null {
  const line = stdout.split("\n").find((l) => l.startsWith(SUMMARY_SENTINEL));
  if (!line) return null;
  let parsed: RawSummary;
  try {
    // JSON.parse is `any` by definition; the annotation is what keeps it from
    // leaking out of this function into the admin UI's rendering of the counts.
    parsed = JSON.parse(line.slice(SUMMARY_SENTINEL.length)) as RawSummary;
  } catch {
    return null;
  }
  return {
    action: parsed.mode === "purge-transactional" ? "purge" : "reseed",
    before: parsed.before ?? null,
    after: parsed.after ?? {},
    durationMs: parsed.durationMs ?? 0,
  };
}

function runScript(action: DemoAction): Promise<string> {
  const mode = action === "purge" ? "purge-transactional" : "reseed";
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [SCRIPT_PATH, `--mode=${mode}`],
      {
        cwd: process.cwd(),
        env: process.env,
        timeout: TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error?.killed) {
          reject(new DemoToolError("TIMEOUT", "Demo operation timed out. Check the database connection and try again."));
          return;
        }
        if (error) {
          const detail = (stderr || error.message).trim().split("\n").slice(-6).join("\n");
          reject(new DemoToolError("SCRIPT_FAILED", detail || "Demo operation failed."));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/**
 * Both actions invalidate the same surfaces: the health page's own cached
 * snapshot, and every route whose rendered content came from the tables that
 * were just truncated.
 */
function invalidateAfterDemoChange(): void {
  revalidateTag(DB_HEALTH_CACHE_TAG);
  for (const route of [
    "/admin/health",
    "/board",
    "/reception",
    "/my-queue",
    "/production",
    "/pricing",
    "/accounting/orders",
    "/finance/expenses",
    "/notifications",
  ]) {
    revalidatePath(route);
  }
  // Open operator screens hold cards for work items that no longer exist. A bulk
  // TRUNCATE emits no per-row NOTIFY, so without this they would sit on stale
  // cards until someone reloaded by hand.
  getBoardLiveHub().requestResync();
}

async function runDemoAction(actor: Actor, action: DemoAction): Promise<DemoRunResult> {
  authorize(actor, "admin.config");

  const stdout = await runScript(action);
  const summary = parseDemoSummary(stdout);
  if (!summary) {
    throw new DemoToolError("NO_SUMMARY", "Demo operation did not report a result. The database may be unchanged.");
  }

  invalidateAfterDemoChange();

  await audit.record({
    action: action === "purge" ? "demo.data_purged" : "demo.data_reseeded",
    entityType: "DemoData",
    entityId: "operational",
    actorId: actor.userId,
    // The per-table row counts are the "after" state of the change; recorded so
    // the audit log shows what the database looks like post-demo-reset.
    after: summary.after,
    reason:
      action === "purge"
        ? "Admin cleared operational data for a clean customer demo"
        : "Admin reset and reseeded demo data",
  });

  return summary;
}

/** Clear operational data; keep users, config and reference data intact. */
export function purgeDemoData(actor: Actor): Promise<DemoRunResult> {
  return runDemoAction(actor, "purge");
}

/** Full reset: clear operational data, then reload the curated demo dataset. */
export function reseedDemoData(actor: Actor): Promise<DemoRunResult> {
  return runDemoAction(actor, "reseed");
}
