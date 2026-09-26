// The Admin thresholds screen — contracts/ui.md §/admin/notifications (US5).
//
// This screen exists for TWO audiences, which is why it is the most layered
// page in the feature:
//   1. an Admin tuning thresholds and controlling the scheduler (FR-053/054);
//   2. an Admin who noticed a MISSING notification — the unmapped-types table
//      answers "was the event never emitted, or emitted without a catalog
//      entry?" (FR-019), which is the difference between a two-minute fix and
//      an afternoon of guessing.
//
// `admin.config` is enforced in the services; this page additionally refuses to
// render for a caller without it, so a receptionist who navigates here by
// typing the URL sees a refusal rather than a table of controls that would
// each fail on submit.

import { getActor } from "~/server/auth";
import {
  isSchedulerRunning,
  readThresholds,
  schedulerStatus,
  type DelayPhase,
} from "~/server/notifications";
import ar from "~/messages/ar.json";
import {
  setSchedulerRunningForm,
  triggerSchedulerForm,
  updateThresholdsForm,
} from "./actions";

const N = ar.notifications;

const PHASE_LABEL: Record<DelayPhase, string> = {
  DESIGN: N.phaseDesign,
  REVIEW: N.phaseReview,
  PRICING: N.phasePricing,
  PRODUCTION: N.phaseProduction,
  COLLECTION: N.phaseCollection,
};

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const actor = await getActor();
  const params = await searchParams;

  if (!actor.permissions.has("admin.config")) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{N.errorForbidden}</p>;
  }

  const [thresholds, status] = await Promise.all([readThresholds(), schedulerStatus(actor)]);
  const running = isSchedulerRunning() || status.running;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{N.thresholdTitle}</h1>

      {params.error && (
        <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">
          {params.error}
        </p>
      )}

      {/* --- thresholds ---------------------------------------------------- */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{N.thresholdPhaseHeader}</th>
              <th className="px-4 py-3 text-start font-medium">{N.thresholdDurationHeader}</th>
              <th className="px-4 py-3 text-start font-medium">{N.thresholdRecipientsHeader}</th>
              <th className="px-4 py-3 text-start font-medium">{N.thresholdEscalationHeader}</th>
              <th className="px-4 py-3 text-start font-medium"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {thresholds.map((threshold) => (
              <tr key={threshold.phase} className="bg-card align-top">
                <td className="px-4 py-3 font-medium">
                  {PHASE_LABEL[threshold.phase]}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {threshold.thresholdMinutes === null ? N.thresholdDisabled : N.thresholdEnabled}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form id={`threshold-${threshold.phase}`} action={updateThresholdsForm} className="contents">
                    <input type="hidden" name="phase" value={threshold.phase} />
                    <input
                      type="text"
                      name="thresholdMinutes"
                      defaultValue={threshold.thresholdInput}
                      placeholder="4h"
                      aria-label={`${PHASE_LABEL[threshold.phase]} — ${N.thresholdDurationHeader}`}
                      className="w-24 rounded-md border border-border bg-background px-2 py-1"
                    />
                    <span className="mt-1 block text-xs text-muted-foreground">{N.thresholdHint}</span>
                  </form>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {threshold.alertRoles.length > 0 && (
                    <span className="block">{threshold.alertRoles.join("، ")}</span>
                  )}
                  {threshold.alertPermissions.length > 0 && (
                    <span className="block">{threshold.alertPermissions.join("، ")}</span>
                  )}
                  {threshold.alertRoles.length === 0 && threshold.alertPermissions.length === 0 && (
                    <span>{N.overridesEmpty}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <form action={updateThresholdsForm} className="contents">
                    <input type="hidden" name="phase" value={threshold.phase} />
                    <input
                      type="hidden"
                      name="thresholdMinutes"
                      value={threshold.thresholdMinutes ?? ""}
                    />
                    <input
                      type="text"
                      name="escalationMinutes"
                      defaultValue={threshold.escalationInput}
                      placeholder="—"
                      aria-label={`${PHASE_LABEL[threshold.phase]} — ${N.thresholdEscalationHeader}`}
                      className="w-24 rounded-md border border-border bg-background px-2 py-1"
                    />
                  </form>
                </td>
                <td className="px-4 py-3">
                  <form action={updateThresholdsForm} className="flex flex-col gap-2">
                    <input type="hidden" name="phase" value={threshold.phase} />
                    <input
                      type="hidden"
                      name="thresholdMinutes"
                      value={threshold.thresholdMinutes ?? ""}
                    />
                    <label className="sr-only" htmlFor={`reason-${threshold.phase}`}>
                      {N.thresholdReasonLabel}
                    </label>
                    <input
                      id={`reason-${threshold.phase}`}
                      type="text"
                      name="reason"
                      required
                      placeholder={`${N.thresholdReasonLabel} — ${N.thresholdReasonRequired}`}
                      className="w-40 rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground"
                    >
                      {N.thresholdSave}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- scheduler ----------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{N.schedulerTitle}</h2>
        <div className="rounded-lg border border-border p-4 text-sm">
          <p>
            {running ? N.schedulerRunning : N.schedulerStopped}
            {status.leaseOwner && ` — ${N.schedulerLeaseOwner}: ${status.leaseOwner}`}
          </p>
          <p className="text-muted-foreground">
            {N.schedulerLastRun}: {status.lastRun ? new Date(status.lastRun.startedAt).toLocaleString("ar-EG") : N.schedulerNeverRun}
          </p>
          <p className="text-muted-foreground">
            {N.schedulerNextRun}: {status.nextRunAt ? new Date(status.nextRunAt).toLocaleString("ar-EG") : "—"}
          </p>
          {status.lastRun && (
            <p className="text-muted-foreground">
              {N.schedulerEvaluated}: {status.lastRun.evaluated} · {N.schedulerFlagged}: {status.lastRun.flagged} ·{" "}
              {N.schedulerAlerted}: {status.lastRun.alerted}
            </p>
          )}
          {status.lastRun?.error && (
            <p role="alert" className="mt-1 text-destructive">
              {status.lastRun.error}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={triggerSchedulerForm}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
              >
                {N.schedulerRunNow}
              </button>
            </form>
            {/* FR-054: BOTH transitions need a control, so the scheduler is
                startable and stoppable without a redeploy. Stopping is a local
                pause of this process's interval, not a global kill. */}
            <form action={setSchedulerRunningForm}>
              <input type="hidden" name="running" value={running ? "false" : "true"} />
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
              >
                {running ? N.schedulerStop : N.schedulerStart}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* --- unmapped types (FR-019) --------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{N.unmappedTitle}</h2>
        {status.unmappedTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{N.unmappedEmpty}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{N.unmappedTypeHeader}</th>
                  <th className="px-4 py-3 text-start font-medium">{N.unmappedCountHeader}</th>
                  <th className="px-4 py-3 text-start font-medium">{N.unmappedLastSeenHeader}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {status.unmappedTypes.map((row) => (
                  <tr key={row.type} className="bg-card">
                    <td className="px-4 py-3 font-mono text-xs">{row.type}</td>
                    <td className="px-4 py-3">{row.count}</td>
                    <td className="px-4 py-3">{new Date(row.lastSeenAt).toLocaleString("ar-EG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- stuck events (FR-008) ----------------------------------------- */}
      {status.failedTypes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{N.failedTitle}</h2>
          <ul className="rounded-lg border border-border p-4 text-sm">
            {status.failedTypes.map((row) => (
              <li key={row.type} className="font-mono text-xs">
                {row.type} × {row.count}
                {row.lastError && <span className="block font-sans text-muted-foreground">{row.lastError}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
