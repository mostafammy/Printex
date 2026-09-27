// Delay detection — the age derivation, the state→phase mapping, and the
// delayed-work query. contracts/notification-service.md §getDelayedWorkItems,
// research.md §Decision: workflow-phase waiting age comes from the open
// PhaseTiming queue segment; pricing age comes from 051.
//
// THE CENTRAL INVARIANT: delay state is DERIVED, never stored (FR-059).
// There is no `delayed` column on WorkItem, so a Work Item that has moved on
// is absent from the result on the very next call, and lowering a threshold
// changes the result with no migration and no backfill. There is exactly one
// stored delay record — `DelayBreach` — and it exists solely to make "one
// alert per breach" a schema property, not to answer "is this late now?"
//
// A second invariant, and the reason this function is pure: detection is
// INERT (FR-068). Nothing here writes a Work Item state, a PricingStatus, or
// any business gate. The scheduler only ever writes Notification, DelayBreach,
// SchedulerRun, and SchedulerLease (constitution II).

import type { Prisma } from "../../../generated/prisma";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import type { WorkItemState } from "~/server/core";
import { DomainNotificationError } from "./errors";
import { DELAY_PHASES, PHASE_LABELS_AR, isDelayPhase, type DelayPhase } from "./config";
import { pendingSince } from "~/server/pricing";
import { thresholdMap } from "./thresholds";

export { DELAY_PHASES, PHASE_LABELS_AR, isDelayPhase };
export type { DelayPhase };

/** States a Work Item can never be delayed in — it is finished, or abandoned. */
export const TERMINAL_STATES: readonly WorkItemState[] = ["DELIVERED", "COMPLETED", "CANCELLED"];

/**
 * The five measured phases, mapped from the Work Item's CURRENT state.
 *
 * `DelayPhase` is distinct from `WorkItemState` on purpose: a Work Item in
 * `WAITING_REVIEW` is measured against the *review* threshold, and that
 * mapping is 053-owned configuration logic — not a second state machine
 * (constitution I). A state absent from this table maps to no phase, which is
 * how FR-040's "a Work Item with no design requirement is never design
 * delayed" falls out: `requiresDesign = false` never enters a design state,
 * so the design threshold is never evaluated for it.
 */
const STATE_TO_PHASE: Readonly<Partial<Record<WorkItemState, DelayPhase>>> = {
  // --- DESIGN: 002's design states, 4h default --------------------------
  ASSIGNED: "DESIGN",
  IN_DESIGN: "DESIGN",
  // --- REVIEW: 013's review states, 1h default ---------------------------
  WAITING_REVIEW: "REVIEW",
  REWORK_REQUIRED: "REVIEW",
  // --- PRODUCTION: 014's production states, 8h default -------------------
  READY_FOR_PRODUCTION: "PRODUCTION",
  IN_PRODUCTION: "PRODUCTION",
  // --- COLLECTION: 015's collection states, 24h default ------------------
  READY_FOR_COLLECTION: "COLLECTION",
  // NOT MAPPED:
  //   NEW             — nothing has been assigned yet
  //   DESIGN_COMPLETED— between design and review; 002's transient
  //   APPROVED        — between review and pricing
  //   WAITING_PRICING — pricing is measured from PricingStatus.waitingSince,
  //                     NOT from a workflow segment, because 051 tracks
  //                     pricing independently of workflow state (PRD §55
  //                     Rule 9). See `phaseForWorkItem` below, which consults
  //                     the pricing status before falling back to this map.
  //   PRODUCTION_COMPLETED, DELIVERED, COMPLETED, CANCELLED — terminal
};

/** States on the production side, for the derived `work_item.urgent` entry. */
const PRODUCTION_SIDE_STATES: readonly WorkItemState[] = [
  "READY_FOR_PRODUCTION",
  "IN_PRODUCTION",
  "PRODUCTION_COMPLETED",
  "READY_FOR_COLLECTION",
  "DELIVERED",
];

/** True when `state` is finished or abandoned (FR-039). */
export function isTerminalState(state: WorkItemState): boolean {
  return (TERMINAL_STATES as readonly string[]).includes(state);
}

/** The measured phase for a Work Item in `state`, or `null` if none. */
export function phaseForState(state: WorkItemState): DelayPhase | null {
  return STATE_TO_PHASE[state] ?? null;
}

/** True when `state` is on the production side (drives `work_item.urgent`). */
export function isProductionSideState(state: WorkItemState): boolean {
  return (PRODUCTION_SIDE_STATES as readonly string[]).includes(state);
}

/** Whole minutes between `from` and `to`, floored at 0. */
export function ageMinutes(from: Date | null | undefined, now: Date = new Date()): number | null {
  if (!from) return null;
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
}

/**
 * The ONE Arabic age formatter, used by the catalog body, the delayed list,
 * the notification page, and 090's dashboard (SC-012: the same age must never
 * render two ways on two screens).
 *
 * Renders `2h 14m` / `٣س ١٤د`. A pure function of minutes, so the two screens
 * cannot disagree — there is no second implementation to drift.
 */
export function formatAge(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${toArabicDigits(mins)}د`;
  if (mins === 0) return `${toArabicDigits(hours)}س`;
  return `${toArabicDigits(hours)}س ${toArabicDigits(mins)}د`;
}

/**
 * Arabic-Indic digits. The bell badge and every age render in the shop's
 * numeral system (constitution IX); `99+` and `100` stay ASCII because that
 * bound is a UI convention, not prose.
 *
 * The implementation lives in `~/lib/ar-format` so the CLIENT-side bell can
 * import the same function — a client module may not pull this feature's
 * barrel (it transitively reaches `next/headers` and breaks `next build`).
 * Re-exported here so the public barrel contract is unchanged (SC-012: one
 * implementation, never two).
 */
export { toArabicDigits } from "~/lib/ar-format";
import { toArabicDigits } from "~/lib/ar-format";

/** Full minutes of a duration input: `30` → 30, `4h` → 240, `1h30m` → 90. */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "") return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const h = /^(\d+)\s*h$/.exec(trimmed);
  if (h) return Number(h[1]) * 60;
  const combined = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/.exec(trimmed);
  if (combined && (combined[1] || combined[2])) {
    return Number(combined[1] ?? 0) * 60 + Number(combined[2] ?? 0);
  }
  return NaN;
}

/** Renders a duration the way the Admin screen's input expects it back. */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h${mins}m`;
}

// --- the two age anchors -----------------------------------------------------

export type AgeAnchor = "PHASE_TIMING" | "PRICING_STATUS";

export interface WorkItemAgeInput {
  readonly workItemId: string;
  readonly state: WorkItemState;
  readonly requiresDesign: boolean;
  /** The open QUEUE segment's `startedAt` for the current phase, if any. */
  readonly openQueueStartedAt: Date | null;
  /** 051's `PricingStatus.waitingSince`, read separately. */
  readonly pricingWaitingSince: Date | null;
  readonly pricingResolved: boolean;
  readonly now?: Date;
}

export interface DerivedDelay {
  readonly phase: DelayPhase | null;
  readonly anchor: AgeAnchor | null;
  readonly waitingSince: Date | null;
  readonly waitingAgeMinutes: number | null;
}

/**
 * The pure derivation: state (+ pricing status) → phase, anchor, age.
 *
 * Kept free of I/O so T015 can walk all 15 states in a unit test without a
 * database, and so the query and the tick cannot disagree about what "late"
 * means (the single most important property here: if the tick and the list
 * used different logic, the shop would be shown work that is not alerting, or
 * alerted about work the list says is fine).
 */
export function deriveDelay(input: WorkItemAgeInput): DerivedDelay {
  const now = input.now ?? new Date();
  const none: DerivedDelay = {
    phase: null,
    anchor: null,
    waitingSince: null,
    waitingAgeMinutes: null,
  };

  // FR-039: a finished Work Item is never delayed. Checked before anything
  // else so a stale anchor on a delivered item can never surface it.
  if (isTerminalState(input.state)) return none;

  // Pricing is measured from 051's own timestamp, NOT from the workflow
  // segment, and NOT only when the Work Item happens to be in
  // WAITING_PRICING: 051 tracks pricing independently of workflow state, so a
  // Work Item IN PRODUCTION with an unresolved price is still aging (PRD §55
  // Rule 9 — "pricing status must be visible independently from production
  // status"). An item can be both in a workflow phase and waiting on price;
  // when it is, the pricing delay is the one the shop can act on fastest, so
  // it is measured here and the workflow phase resumes if pricing resolves.
  if (!input.pricingResolved && input.pricingWaitingSince) {
    return {
      phase: "PRICING",
      anchor: "PRICING_STATUS",
      waitingSince: input.pricingWaitingSince,
      waitingAgeMinutes: ageMinutes(input.pricingWaitingSince, now),
    };
  }

  // FR-040: a Work Item that never needed a design cannot be sitting in a
  // design state, so it can never be design-delayed. Asserted rather than
  // assumed — a fixture or a data fix that put a no-design item in ASSIGNED
  // would otherwise alert on a phase that does not apply to it.
  if (!input.requiresDesign && (input.state === "ASSIGNED" || input.state === "IN_DESIGN")) {
    return none;
  }

  const phase = phaseForState(input.state);
  if (!phase) return none;

  const waitingSince = input.openQueueStartedAt;
  if (!waitingSince) return none;

  return {
    phase,
    anchor: "PHASE_TIMING",
    waitingSince,
    waitingAgeMinutes: ageMinutes(waitingSince, now),
  };
}

// --- database reads ----------------------------------------------------------

type AgeClient = Pick<Prisma.TransactionClient, "phaseTiming" | "pricingStatus">;

/**
 * Loads the raw age inputs for many Work Items in two queries, not 2N.
 *
 * A tick touches every open Work Item in the shop, so per-item reads would
 * make the tick scale with round trips rather than with rows (plan.md
 * §Performance: the tick must not touch more rows than the open Work Item
 * count, and certainly not 2× the queries).
 */
export async function loadAgeInputs(
  workItems: ReadonlyArray<{ id: string; state: WorkItemState; requiresDesign: boolean }>,
  client: AgeClient = db,
): Promise<Map<string, WorkItemAgeInput>> {
  const ids = workItems.map((w) => w.id);
  if (ids.length === 0) return new Map();

  const [segments, statuses] = await Promise.all([
    client.phaseTiming.findMany({
      where: { workItemId: { in: ids }, kind: "QUEUE", endedAt: null },
      select: { workItemId: true, startedAt: true },
    }),
    client.pricingStatus.findMany({
      where: { workItemId: { in: ids } },
      select: { workItemId: true, status: true, waitingSince: true },
    }),
  ]);

  // An item has at most one open QUEUE segment, but a data anomaly could
  // produce two; the earliest is the correct anchor, since a later one would
  // understate how long the Work Item has been waiting.
  const anchorByItem = new Map<string, Date>();
  for (const segment of segments) {
    const existing = anchorByItem.get(segment.workItemId);
    if (!existing || segment.startedAt < existing) {
      anchorByItem.set(segment.workItemId, segment.startedAt);
    }
  }

  const statusByItem = new Map(
    statuses.map((status) => [
      status.workItemId,
      // `pricingStatus` is 051's enum; anything other than PRICED counts as
      // unresolved (PENDING or DISPUTED — research.md §anchors).
      { resolved: status.status === "PRICED", waitingSince: status.waitingSince },
    ]),
  );

  return new Map(
    workItems.map((workItem) => {
      const status = statusByItem.get(workItem.id);
      return [
        workItem.id,
        {
          workItemId: workItem.id,
          state: workItem.state,
          requiresDesign: workItem.requiresDesign,
          openQueueStartedAt: anchorByItem.get(workItem.id) ?? null,
          pricingWaitingSince: status?.waitingSince ?? null,
          pricingResolved: status?.resolved ?? false,
        },
      ];
    }),
  );
}

/**
 * 051's own `pendingSince`, unwrapped. `pendingSince` returns a
 * `Result<Date | null, DomainPricingError>` because it lives in `core`, where
 * nothing throws; the only error it can produce is a missing Work Item, and
 * 053's caller has already loaded the Work Item. A `Date | null` here keeps
 * the derivation above free of Result plumbing for no lost safety.
 */
export async function pricingPendingSince(workItemId: string): Promise<Date | null> {
  const result = await pendingSince(workItemId);
  return result.ok ? result.value : null;
}

// --- the delayed-work query --------------------------------------------------

export interface DelayedFilter {
  /**
   * A measured phase. Typed `string` on purpose: this filter is built from
   * URL search params, so the value is untrusted input, and the narrowing
   * happens in `validateDelayedFilter` where an unknown phase is a VALIDATION
   * error rather than a `never` the compiler has already assumed away.
   */
  readonly phase?: string;
  readonly priority?: "NORMAL" | "URGENT";
  readonly departmentId?: string;
  /** ISO-8601; Work Items created on/after. */
  readonly from?: string;
  /** ISO-8601; Work Items created on/before. */
  readonly to?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface DelayedWorkItemView {
  readonly workItemId: string;
  readonly orderId: string;
  readonly orderNumber: number;
  readonly customerName: string;
  readonly productTypeName: string | null;
  readonly state: WorkItemState;
  readonly phase: DelayPhase;
  readonly priority: "NORMAL" | "URGENT";
  /** The anchor, NOT a computed age — ISO-8601 UTC. */
  readonly waitingSince: string;
  readonly waitingAgeMinutes: number;
  readonly thresholdMinutes: number;
  readonly responsibleDepartmentId: string | null;
  readonly responsibleDepartmentName: string | null;
}

/** One row's data, before the age is derived. */
export interface DelayCandidate {
  readonly workItemId: string;
  readonly orderId: string;
  readonly orderNumber: number;
  readonly customerName: string;
  readonly productTypeName: string | null;
  readonly state: WorkItemState;
  readonly priority: "NORMAL" | "URGENT";
  readonly createdAt: Date;
  readonly departmentId: string | null;
  readonly departmentName: string | null;
  readonly requiresDesign: boolean;
  readonly assigneeId?: string | null;
}

export type ThresholdRow = {
  readonly phase: DelayPhase;
  readonly thresholdMinutes: number | null;
  readonly alertRoles: readonly string[];
  readonly alertPermissions: readonly string[];
  readonly alertDepartmentIds: readonly string[];
};

export type DelayOutcome =
  | { readonly kind: "NONE" }
  | {
      readonly kind: "DELAYED";
      readonly phase: DelayPhase;
      readonly thresholdMinutes: number;
      readonly waitingSince: Date;
      readonly waitingAgeMinutes: number;
    };

/**
 * Applies the thresholds to one derived age. The whole "am I late?" decision
 * in one pure function, so the tick (which alerts) and the query (which
 * lists) can never diverge — the failure where a worker's screen says a job
 * is fine while the shop's been alerted about it is the one this feature
 * cannot have.
 */
export function evaluateDelay(
  derived: DerivedDelay,
  thresholds: ReadonlyMap<DelayPhase, ThresholdRow>,
): DelayOutcome {
  if (!derived.phase || derived.waitingSince === null || derived.waitingAgeMinutes === null) {
    return { kind: "NONE" };
  }
  const threshold = thresholds.get(derived.phase);
  // A disabled phase (thresholdMinutes = null) never alerts and never lists.
  if (threshold?.thresholdMinutes == null) return { kind: "NONE" };
  // `>` not `>=`: at exactly the threshold the Work Item is not yet late,
  // which matches the seed's "4 hours" reading and avoids a boundary
  // disagreement between a hand-checked test and the tick.
  if (derived.waitingAgeMinutes <= threshold.thresholdMinutes) return { kind: "NONE" };

  return {
    kind: "DELAYED",
    phase: derived.phase,
    thresholdMinutes: threshold.thresholdMinutes,
    waitingSince: derived.waitingSince,
    waitingAgeMinutes: derived.waitingAgeMinutes,
  };
}

/** The recipients a breach alerts, from the phase's threshold row. */
export function thresholdRecipients(row: ThresholdRow) {
  return {
    roles: [...row.alertRoles],
    permissions: [...row.alertPermissions],
    departmentIds: [...row.alertDepartmentIds],
  };
}

/**
 * Narrows candidates to the actor's scope (FR-057, contract §Scope rules).
 *
 * The scope rule is applied to the CANDIDATE SET, before the count, so
 * `total` cannot reveal the existence of out-of-scope work — a Banner
 * operator must not learn that a Digital job is late merely by counting
 * (SC-005, US6 scenario 3).
 */
export function isInActorScope(
  actor: Actor,
  candidate: { departmentId: string | null; assigneeId: string | null },
): boolean {
  if (
    actor.roles.includes("ADMIN_OWNER") ||
    actor.roles.includes("HEAD_DESIGNER") ||
    actor.roles.includes("RECEPTION")
  ) {
    return true;
  }
  if (actor.roles.includes("PRODUCTION_OPERATOR")) {
    return candidate.departmentId !== null && actor.departmentIds.includes(candidate.departmentId);
  }
  if (actor.roles.includes("DESIGNER")) {
    return candidate.assigneeId === actor.userId;
  }
  // An actor whose roles match none of the five (ACCOUNTING,
  // PRINT_RECEPTION_DELIVERY, a user with no role at all) sees nothing rather
  // than everything: defaulting to "all" would leak the whole shop to anyone
  // whose role this table has not enumerated yet.
  return false;
}

export function validateDelayedFilter(filter: DelayedFilter): void {
  if (filter.page !== undefined && (!Number.isInteger(filter.page) || filter.page < 1)) {
    throw new DomainNotificationError("VALIDATION", "page must be a positive integer");
  }
  if (filter.pageSize !== undefined && (!Number.isInteger(filter.pageSize) || filter.pageSize < 1 || filter.pageSize > 200)) {
    throw new DomainNotificationError("VALIDATION", "pageSize must be between 1 and 200");
  }
  if (filter.phase !== undefined && !isDelayPhase(filter.phase)) {
    throw new DomainNotificationError("VALIDATION", `unknown phase: ${filter.phase}`);
  }
}

// --- the database-backed query ----------------------------------------------

/**
 * The delayed Work Items visible to `actor`, worst first.
 *
 * Three steps in a fixed order, and the order is the security property:
 * derive → SCOPE → paginate. Scoping before counting is what stops `total`
 * from revealing the existence of out-of-scope work (FR-057, SC-005); the
 * alternative — paginate then scope — would return a short page and a total
 * that leaks.
 *
 * Delay is DERIVED at query time from PhaseTiming / PricingStatus. There is no
 * `delayed` column, so a Work Item that moved on is gone on the very next
 * call and lowering a threshold changes the result with no migration and no
 * backfill (FR-059).
 */
export async function getDelayedWorkItems(
  actor: Actor,
  filter: DelayedFilter = {},
): Promise<{ rows: DelayedWorkItemView[]; total: number; nextPage?: number }> {
  validateDelayedFilter(filter);
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 50;
  const now = new Date();

  const where: Prisma.WorkItemWhereInput = {
    state: { notIn: ["DELIVERED", "COMPLETED", "CANCELLED"] },
  };
  if (filter.departmentId) where.departmentId = filter.departmentId;
  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: new Date(filter.from) } : {}),
      ...(filter.to ? { lte: new Date(filter.to) } : {}),
    };
  }
  if (filter.priority) {
    where.order = { priority: filter.priority };
  }

  const workItems = await db.workItem.findMany({
    where,
    select: {
      id: true,
      state: true,
      requiresDesign: true,
      assigneeId: true,
      createdAt: true,
      departmentId: true,
      department: { select: { name: true } },
      order: {
        select: { id: true, number: true, priority: true, customer: { select: { name: true } } },
      },
      productType: { select: { name: true } },
    },
  });

  const candidates: DelayCandidate[] = workItems.map((workItem) => ({
    workItemId: workItem.id,
    orderId: workItem.order.id,
    orderNumber: workItem.order.number,
    customerName: workItem.order.customer.name,
    productTypeName: workItem.productType?.name ?? null,
    state: workItem.state,
    priority: workItem.order.priority,
    createdAt: workItem.createdAt,
    departmentId: workItem.departmentId,
    departmentName: workItem.department?.name ?? null,
    requiresDesign: workItem.requiresDesign,
    assigneeId: workItem.assigneeId,
  }));

  // Scope BEFORE counting. `isInActorScope` reads the actor's roles and
  // departmentIds, and defaults an unrecognised role to "nothing" rather than
  // "everything" — a new role must not silently gain the whole shop.
  const inScope = candidates.filter((candidate) =>
    isInActorScope(actor, {
      departmentId: candidate.departmentId,
      assigneeId: candidate.assigneeId ?? null,
    }),
  );

  const [ageInputs, thresholds] = await Promise.all([
    loadAgeInputs(
      inScope.map((c) => ({ id: c.workItemId, state: c.state, requiresDesign: c.requiresDesign })),
    ),
    thresholdMap(),
  ]);

  const delayed: Array<DelayedWorkItemView> = [];
  for (const candidate of inScope) {
    const input = ageInputs.get(candidate.workItemId);
    if (!input) continue;
    const outcome = evaluateDelay(deriveDelay({ ...input, now }), thresholds);
    if (outcome.kind === "NONE") continue;
    if (filter.phase && outcome.phase !== filter.phase) continue;

    delayed.push({
      workItemId: candidate.workItemId,
      orderId: candidate.orderId,
      orderNumber: candidate.orderNumber,
      customerName: candidate.customerName,
      productTypeName: candidate.productTypeName,
      state: candidate.state,
      phase: outcome.phase,
      priority: candidate.priority,
      waitingSince: outcome.waitingSince.toISOString(),
      waitingAgeMinutes: outcome.waitingAgeMinutes,
      thresholdMinutes: outcome.thresholdMinutes,
      // The responsible department is the Work Item's own department; a phase
      // that maps to a role (review, pricing) leaves it null, because the
      // catalog's recipient list is what names the responsible party there
      // (data-model.md §Derived).
      responsibleDepartmentId: candidate.departmentId,
      responsibleDepartmentName: candidate.departmentName,
    });
  }

  // Worst first — the shop's question is "what is most late?", not "what is
  // late in insertion order" (contract §4).
  delayed.sort((a, b) => b.waitingAgeMinutes - a.waitingAgeMinutes);

  const total = delayed.length;
  const start = (page - 1) * pageSize;
  const rows = delayed.slice(start, start + pageSize);

  return { rows, total, nextPage: start + pageSize < total ? page + 1 : undefined };
}

/**
 * Every currently-delayed Work Item id, UNSCOPED.
 *
 * For 011's reserved seam (`opts.getDelayedWorkItemIds`). Unscoped by design:
 * it is a membership test inside 011's own already-authorized queue query, not
 * a read of Work Item content — 011 performs its own authorization
 * (contract §getDelayedWorkItemIds, 011 FR-008a).
 *
 * Returns an empty set on failure rather than throwing: 011's queue must keep
 * working when 053's query is unavailable, which is exactly what 011 FR-008a
 * requires. A thrown error here would take the reception queue down over a
 * feature that only decorates it with a badge.
 */
export async function getDelayedWorkItemIds(): Promise<ReadonlySet<string>> {
  try {
    const now = new Date();
    const [workItems, thresholds] = await Promise.all([
      db.workItem.findMany({
        where: { state: { notIn: ["DELIVERED", "COMPLETED", "CANCELLED"] } },
        select: { id: true, state: true, requiresDesign: true },
      }),
      thresholdMap(),
    ]);

    const ageInputs = await loadAgeInputs(workItems);
    const ids = new Set<string>();
    for (const workItem of workItems) {
      const input = ageInputs.get(workItem.id);
      if (!input) continue;
      if (evaluateDelay(deriveDelay({ ...input, now }), thresholds).kind === "DELAYED") {
        ids.add(workItem.id);
      }
    }
    return ids;
  } catch {
    return new Set();
  }
}
