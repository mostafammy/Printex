// Process-wide state for the two notification intervals (T087).
//
// Why `globalThis` and not a module-level `let`: a dev hot reload
// re-instantiates the module, resetting its `let interval` to null while the
// PREVIOUS instance's setInterval handle keeps firing — `start()` would then
// pass its guard and stack a second interval on top of the orphaned one,
// which is exactly the stacking T035 forbids. A `globalThis` slot survives
// re-instantiation, so start / stop / isRunning agree across every module
// instance in the process: hot-reload stacking is structurally impossible,
// not merely unlikely.

/** One interval handle, whichever runtime's `setInterval` produced it. */
export type NotificationTimer = ReturnType<typeof setInterval>;

export interface NotificationTimerState {
  delayTimer?: NotificationTimer;
  processorTimer?: NotificationTimer;
}

const STATE_KEY = "__printexNotifications";

/**
 * The process-wide timer slot, created on first use. Shared by
 * `scheduler.ts` and `processor.ts` (each start/stop/isRunning pair reads
 * and writes through this one accessor). Internal to the module — not part
 * of the `~/server/notifications` barrel.
 */
export function timerState(): NotificationTimerState {
  const scope = globalThis as { __printexNotifications?: NotificationTimerState };
  const existing = scope.__printexNotifications;
  if (existing) return existing;
  const created: NotificationTimerState = {};
  scope[STATE_KEY] = created;
  return created;
}
