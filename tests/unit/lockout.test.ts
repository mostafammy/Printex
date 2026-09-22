// Unit tests for the lockout pure functions — T009.
//
// These tests operate exclusively on plain data (failedLoginAttempts: number,
// lockedUntil: Date | null) — no DB, no Better Auth, no Next.js involved.
// They import the pure decision functions directly from lockout.ts.

import { describe, expect, it } from "vitest";
import {
  isLockedOut,
  nextStateOnFailure,
  nextStateOnSuccess,
  type LockoutState,
} from "~/server/auth/lockout";

// Helpers
const LOCKED_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function clean(): LockoutState {
  return { failedLoginAttempts: 0, lockedUntil: null };
}

describe("isLockedOut", () => {
  it("returns false when lockedUntil is null", () => {
    expect(isLockedOut({ lockedUntil: null })).toBe(false);
  });

  it("returns false when lockedUntil is in the past", () => {
    const pastDate = new Date(Date.now() - 1000); // 1 second ago
    expect(isLockedOut({ lockedUntil: pastDate })).toBe(false);
  });

  it("returns true when lockedUntil is in the future", () => {
    const futureDate = new Date(Date.now() + 60_000); // 1 minute from now
    expect(isLockedOut({ lockedUntil: futureDate })).toBe(true);
  });

  it("accepts an explicit 'now' date for deterministic testing", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const lockedUntil = new Date("2026-01-01T12:15:00Z"); // 15 min in the future relative to now
    expect(isLockedOut({ lockedUntil }, now)).toBe(true);
  });
});

describe("nextStateOnFailure", () => {
  it("increments failedLoginAttempts without locking when below threshold", () => {
    const state = clean();
    const next = nextStateOnFailure(state);
    expect(next.failedLoginAttempts).toBe(1);
    expect(next.lockedUntil).toBeNull();
  });

  it("does not lock on attempt 4 (threshold is 5)", () => {
    const state: LockoutState = { failedLoginAttempts: 3, lockedUntil: null };
    const next = nextStateOnFailure(state); // becomes 4
    expect(next.failedLoginAttempts).toBe(4);
    expect(next.lockedUntil).toBeNull();
  });

  it("sets lockedUntil on the 5th consecutive failure (meets threshold)", () => {
    const state: LockoutState = {
      failedLoginAttempts: LOCKED_THRESHOLD - 1, // 4
      lockedUntil: null,
    };
    const now = new Date("2026-01-01T12:00:00Z");
    const next = nextStateOnFailure(state, now);
    expect(next.failedLoginAttempts).toBe(LOCKED_THRESHOLD);
    expect(next.lockedUntil).not.toBeNull();
    // lockedUntil should be exactly now + 15 minutes.
    expect(next.lockedUntil!.getTime()).toBe(now.getTime() + LOCKOUT_DURATION_MS);
  });

  it("keeps lockedUntil set on subsequent failures past the threshold", () => {
    const alreadyLockedUntil = new Date(Date.now() + 10_000);
    const state: LockoutState = {
      failedLoginAttempts: LOCKED_THRESHOLD + 2, // already past threshold
      lockedUntil: alreadyLockedUntil,
    };
    const now = new Date();
    const next = nextStateOnFailure(state, now);
    expect(next.failedLoginAttempts).toBe(LOCKED_THRESHOLD + 3);
    // lockedUntil is updated to a new future timestamp (>= threshold, so a new lock is computed)
    expect(next.lockedUntil).not.toBeNull();
  });
});

describe("nextStateOnSuccess", () => {
  it("resets failedLoginAttempts to 0", () => {
    const next = nextStateOnSuccess();
    expect(next.failedLoginAttempts).toBe(0);
  });

  it("clears lockedUntil to null", () => {
    const next = nextStateOnSuccess();
    expect(next.lockedUntil).toBeNull();
  });

  it("always returns the same reset state regardless of prior state", () => {
    // Call multiple times — always get the clean state.
    for (let i = 0; i < 3; i++) {
      const next = nextStateOnSuccess();
      expect(next).toEqual({ failedLoginAttempts: 0, lockedUntil: null });
    }
  });
});

describe("lockout flow (end-to-end on pure state)", () => {
  it("fewer than 5 failed attempts: lockedUntil stays null", () => {
    let state = clean();
    for (let i = 0; i < LOCKED_THRESHOLD - 1; i++) {
      state = nextStateOnFailure(state);
    }
    expect(state.failedLoginAttempts).toBe(LOCKED_THRESHOLD - 1);
    expect(state.lockedUntil).toBeNull();
    expect(isLockedOut(state)).toBe(false);
  });

  it("the 5th consecutive failure sets lockedUntil to now + 15 minutes", () => {
    let state = clean();
    const now = new Date("2026-06-01T09:00:00Z");
    for (let i = 0; i < LOCKED_THRESHOLD; i++) {
      state = nextStateOnFailure(state, now);
    }
    expect(state.failedLoginAttempts).toBe(LOCKED_THRESHOLD);
    expect(state.lockedUntil).not.toBeNull();
    expect(state.lockedUntil!.getTime()).toBe(now.getTime() + LOCKOUT_DURATION_MS);
  });

  it("a subsequent attempt while lockedUntil is in the future is rejected by isLockedOut", () => {
    let state = clean();
    const now = new Date("2026-06-01T09:00:00Z");
    // Trigger the lockout.
    for (let i = 0; i < LOCKED_THRESHOLD; i++) {
      state = nextStateOnFailure(state, now);
    }
    // 5 minutes later — still within the 15-minute window.
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
    expect(isLockedOut(state, fiveMinutesLater)).toBe(true);
  });

  it("a successful login resets failedLoginAttempts to 0 and clears lockedUntil", () => {
    let state = clean();
    const now = new Date();
    for (let i = 0; i < LOCKED_THRESHOLD; i++) {
      state = nextStateOnFailure(state, now);
    }
    // Locked after 5 failures.
    expect(state.lockedUntil).not.toBeNull();

    // Successful login (e.g. admin override or lock expired).
    state = nextStateOnSuccess();
    expect(state.failedLoginAttempts).toBe(0);
    expect(state.lockedUntil).toBeNull();
    expect(isLockedOut(state)).toBe(false);
  });
});
