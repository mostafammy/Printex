// Account lockout logic — FR-004 (5 consecutive failures → 15-minute lock).
//
// Split into two layers:
//   1. Pure, DB-free functions (`isLockedOut`, `nextStateOnFailure`,
//      `nextStateOnSuccess`) — these carry all the threshold and duration
//      logic and are directly testable (T009 unit tests) with zero
//      dependencies — no `~/server/db` import at module scope, so importing
//      just these functions never triggers `~/env`'s Zod validation (see
//      tests/helpers/testDb.ts's comment on the same hazard: importing
//      `~/env` eagerly throws in any process where the full env schema
//      — Better Auth secrets, DATABASE_URL, etc. — isn't set, which a pure
//      unit test process has no business requiring). `db` is imported
//      dynamically inside the two DB-calling helpers below instead of
//      statically at the top of this file, specifically to keep this
//      module import-safe for pure-function-only consumers like
//      tests/unit/lockout.test.ts.
//   2. Thin DB-calling helpers (`recordFailedLogin`, `recordSuccessfulLogin`)
//      — these read the User row, delegate the decision to layer 1, and write
//      the result back. Used by the Better Auth `hooks.after` in config.ts.

export interface LockoutState {
  readonly failedLoginAttempts: number;
  readonly lockedUntil: Date | null;
}

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Pure: given current state, is a login attempt right now blocked by an active
 * lockout?  Returns `true` if `lockedUntil` is set and is still in the future.
 */
export function isLockedOut(
  state: Pick<LockoutState, "lockedUntil">,
  now: Date = new Date(),
): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/**
 * Pure: given current state, compute the next state after ONE MORE failed
 * attempt.  When the new failure count meets or exceeds `LOCKOUT_THRESHOLD`,
 * `lockedUntil` is set to `now + LOCKOUT_DURATION_MS`.
 */
export function nextStateOnFailure(state: LockoutState, now: Date = new Date()): LockoutState {
  const failedLoginAttempts = state.failedLoginAttempts + 1;
  const lockedUntil =
    failedLoginAttempts >= LOCKOUT_THRESHOLD
      ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
      : state.lockedUntil;
  return { failedLoginAttempts, lockedUntil };
}

/**
 * Pure: state after a successful login — always resets both fields.
 */
export function nextStateOnSuccess(): LockoutState {
  return { failedLoginAttempts: 0, lockedUntil: null };
}

// ---------------------------------------------------------------------------
// DB-calling helpers — used by the Better Auth hooks.after in config.ts.
// These read the current User row, compute the next state using the pure
// functions above, and persist the result.
// ---------------------------------------------------------------------------

/**
 * Record a failed login attempt for `username`.  Increments the failure
 * counter and, if the threshold is reached, sets `lockedUntil`.
 * No-ops silently when no user with that username exists.
 */
export async function recordFailedLogin(username: string): Promise<void> {
  const { db } = await import("~/server/db");
  const user = await db.user.findUnique({ where: { username } });
  if (!user) return;

  const current: LockoutState = {
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil ?? null,
  };
  const next = nextStateOnFailure(current);

  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: next.failedLoginAttempts,
      lockedUntil: next.lockedUntil,
    },
  });
}

/**
 * Record a successful login for `username`.  Resets `failedLoginAttempts` to
 * 0 and clears `lockedUntil`.
 * No-ops silently when no user with that username exists.
 */
export async function recordSuccessfulLogin(username: string): Promise<void> {
  const { db } = await import("~/server/db");
  const user = await db.user.findUnique({ where: { username } });
  if (!user) return;

  const next = nextStateOnSuccess();

  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: next.failedLoginAttempts,
      lockedUntil: next.lockedUntil,
    },
  });
}
