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

import { ALL_PERMISSIONS, ALL_ROLE_KEYS, getActor } from "~/server/auth";
import { db } from "~/server/db";
import {
  CATALOG,
  isSchedulerRunning,
  listRecipientOverrides,
  readThresholds,
  schedulerStatus,
  type DelayPhase,
  type OverrideView,
  type RecipientSpec,
} from "~/server/notifications";
import ar from "~/messages/ar.json";
import {
  recipientOverrideForm,
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

/** One readable line for a recipient spec — roles, permissions, departments, ids. */
function describeSpec(spec: RecipientSpec, deptNames: ReadonlyMap<string, string>): string {
  const parts = [
    ...(spec.roles ?? []),
    ...(spec.permissions ?? []),
    ...(spec.departmentIds ?? []).map((id) => deptNames.get(id) ?? id),
    ...(spec.userIds ?? []),
  ];
  return parts.length > 0 ? parts.join("، ") : "—";
}

/** The catalog default, or a note when the default depends on the event's context. */
function describeDefault(
  entry: (typeof CATALOG)[number],
  deptNames: ReadonlyMap<string, string>,
): string {
  return typeof entry.recipients === "function"
    ? N.overridesDynamic
    : describeSpec(entry.recipients, deptNames);
}

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

  // The outbox panel's own key (contract permission table): audit.view.
  const canInspectOutbox = actor.permissions.has("audit.view");

  const [thresholds, status, overrides, departments] = await Promise.all([
    readThresholds(),
    schedulerStatus(actor),
    listRecipientOverrides(),
    db.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const deptNames = new Map(departments.map((dept) => [dept.id, dept.name]));
  const overrideByType = new Map<string, OverrideView>(overrides.map((row) => [row.type, row]));
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
                <td className="px-4 py-3">
                  {/* Editable pickers. Associated with the row's SAVE form by
                      id (the `form` attribute), so one حفظ posts phase +
                      thresholdMinutes + every recipient list together
                      (T084 / SC-015). */}
                  <div className="flex flex-col gap-2">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor={`alertRoles-${threshold.phase}`}
                    >
                      {N.recipientsRoles}
                    </label>
                    <select
                      id={`alertRoles-${threshold.phase}`}
                      name="alertRoles"
                      form={`threshold-save-${threshold.phase}`}
                      multiple
                      size={3}
                      defaultValue={[...threshold.alertRoles]}
                      className="min-h-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
                    >
                      {ALL_ROLE_KEYS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>

                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor={`alertPermissions-${threshold.phase}`}
                    >
                      {N.recipientsPermissions}
                    </label>
                    <select
                      id={`alertPermissions-${threshold.phase}`}
                      name="alertPermissions"
                      form={`threshold-save-${threshold.phase}`}
                      multiple
                      size={4}
                      defaultValue={[...threshold.alertPermissions]}
                      className="min-h-20 rounded-md border border-border bg-background px-2 py-1 text-xs"
                    >
                      {ALL_PERMISSIONS.map((permission) => (
                        <option key={permission} value={permission}>
                          {permission}
                        </option>
                      ))}
                    </select>

                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor={`alertDepartments-${threshold.phase}`}
                    >
                      {N.recipientsDepartments}
                    </label>
                    <select
                      id={`alertDepartments-${threshold.phase}`}
                      name="alertDepartmentIds"
                      form={`threshold-save-${threshold.phase}`}
                      multiple
                      size={3}
                      defaultValue={[...threshold.alertDepartmentIds]}
                      className="min-h-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
                    >
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
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
                  <form
                    action={updateThresholdsForm}
                    className="flex flex-col gap-2"
                    id={`threshold-save-${threshold.phase}`}
                  >
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
                      title={N.thresholdReasonRequired}
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

      {/* --- recipient overrides — one card per catalog type (FR-017 / T083) --- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{N.overridesTitle}</h2>
        <p className="text-sm text-muted-foreground">{N.overridesHint}</p>

        <div className="flex flex-col gap-4">
          {CATALOG.map((entry) => {
            const current = overrideByType.get(entry.type);
            return (
              <div key={entry.type} className="rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <code className="text-xs font-semibold">{entry.type}</code>
                  <span className="text-xs text-muted-foreground">{entry.title}</span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {N.overridesDefault}: {describeDefault(entry, deptNames)}
                </p>
                <p className="text-xs">
                  {current
                    ? `${N.overridesCurrent}: ${describeSpec(current, deptNames)}`
                    : N.overridesEmpty}
                </p>

                <form action={recipientOverrideForm} className="mt-3 flex flex-col gap-2">
                  <input type="hidden" name="type" value={entry.type} />

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-1">
                      <label
                        className="text-xs font-medium text-muted-foreground"
                        htmlFor={`ov-roles-${entry.type}`}
                      >
                        {N.recipientsRoles}
                      </label>
                      <select
                        id={`ov-roles-${entry.type}`}
                        name="roles"
                        multiple
                        size={3}
                        defaultValue={[...(current?.roles ?? [])]}
                        className="min-h-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
                      >
                        {ALL_ROLE_KEYS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        className="text-xs font-medium text-muted-foreground"
                        htmlFor={`ov-permissions-${entry.type}`}
                      >
                        {N.recipientsPermissions}
                      </label>
                      <select
                        id={`ov-permissions-${entry.type}`}
                        name="permissions"
                        multiple
                        size={3}
                        defaultValue={[...(current?.permissions ?? [])]}
                        className="min-h-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
                      >
                        {ALL_PERMISSIONS.map((permission) => (
                          <option key={permission} value={permission}>
                            {permission}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        className="text-xs font-medium text-muted-foreground"
                        htmlFor={`ov-departments-${entry.type}`}
                      >
                        {N.recipientsDepartments}
                      </label>
                      <select
                        id={`ov-departments-${entry.type}`}
                        name="departmentIds"
                        multiple
                        size={3}
                        defaultValue={[...(current?.departmentIds ?? [])]}
                        className="min-h-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
                      >
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        className="text-xs font-medium text-muted-foreground"
                        htmlFor={`ov-userIds-${entry.type}`}
                      >
                        {N.recipientsUserIds}
                      </label>
                      <input
                        id={`ov-userIds-${entry.type}`}
                        type="text"
                        name="userIds"
                        defaultValue={(current?.userIds ?? []).join(", ")}
                        placeholder={N.recipientsUserIds}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  {/* ONE reason field serves both buttons — the reason is what
                      FR-061 requires recorded, and the client rejects empty
                      it before the server ever sees the submit. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`ov-reason-${entry.type}`}>
                      {N.thresholdReasonLabel}
                    </label>
                    <input
                      id={`ov-reason-${entry.type}`}
                      type="text"
                      name="reason"
                      required
                      title={N.thresholdReasonRequired}
                      placeholder={`${N.thresholdReasonLabel} — ${N.thresholdReasonRequired}`}
                      className="w-56 rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      name="op"
                      value="set"
                      className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      {N.overridesSave}
                    </button>
                    <button
                      type="submit"
                      name="op"
                      value="clear"
                      className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                    >
                      {N.overridesClear}
                    </button>
                  </div>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      {/* --- outbox inspection (T068 / FR-006 / FR-019) --------------------
          Gated on `audit.view`, not on the page's `admin.config`: the
          contract's permission table scopes "outbox / notification-log
          inspection" to audit.view (authorization-audit.md). Admin/Owner
          holds both, so nothing changes for them — the gate exists so the
          KEY that protects this section is the key the contract names. */}
      {canInspectOutbox && (
      <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{N.outboxInspectionTitle}</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="rounded-md border border-border px-3 py-1">
            {N.outboxProcessed}: {status.outboxTotals.processed}
          </span>
          <span className="rounded-md border border-border px-3 py-1">
            {N.outboxPending}: {status.outboxTotals.pending}
          </span>
          <span className="rounded-md border border-border px-3 py-1">
            {N.outboxFailed}: {status.outboxTotals.failed}
          </span>
          <span className="rounded-md border border-border px-3 py-1">
            {N.outboxUnmapped}: {status.outboxTotals.unmapped}
          </span>
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
      </>
      )}
    </div>
  );
}
