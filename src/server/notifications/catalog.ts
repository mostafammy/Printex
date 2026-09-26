// The shared event vocabulary — contracts/event-catalog.md.
//
// ONE place where every notification event type is spelled. Emitters import
// `Events` and reference a constant; the UI renders titles from here; neither
// writes a string literal. One catalog, one spelling of every event (FR-011).
//
// Pure: no database access, no clock, no I/O. That is what lets the
// catalog's own contract test walk the whole table (T013) and lets
// `renderEntry` be exercised without a fixture.
//
// ALIASES ARE PERMANENT. Both `workitem.*` (012/013/014, shipped) and
// `work_item.*` (002/015/016/091, canonical for new events) resolve here. A
// type that has shipped may be aliased onward, never removed — renaming an
// existing emitter is out of 053's scope and would put this feature in the
// position of breaking a track-A contract (research.md §4).

import type { JsonValue } from "~/server/core";
import type { RecipientSpec } from "./recipients";

/** How an entry is delivered. */
export type Delivery = "DIRECT" | "TRIGGER" | "RECORDED_ONLY";

export type Severity = "INFO" | "ACTION" | "URGENT";

/** What the entry's `entityId` points at, for the deep-link resolver. */
export type CatalogEntity = "WorkItem" | "Order" | "Customer" | "Compensation" | "None";

/** The outbox row's data, as recorded. Everything a body or link may read. */
export interface CatalogContext {
  readonly payload: JsonValue;
  readonly entityId: string | null;
  readonly orderId?: string | null;
  readonly workItemId?: string | null;
}

export interface CatalogEntry {
  /** Canonical type — the key. */
  readonly type: string;
  /** Other spellings that map here (research.md §4). */
  readonly aliases?: readonly string[];
  readonly delivery: Delivery;
  /** Arabic, captured onto the notification at creation (FR-018). */
  readonly title: string;
  /** Arabic. May return "" for a title-only entry. */
  readonly body?: (ctx: CatalogContext) => string;
  /** The DEFAULT recipient specification. An override may only ADD to it. */
  readonly recipients: RecipientSpec | ((ctx: CatalogContext) => RecipientSpec);
  readonly entity?: CatalogEntity;
  /** Deep link, resolved at processing time (FR-022). */
  readonly link?: (ctx: CatalogContext) => string | null;
  readonly severity: Severity;
  /** The feature that emits it — shown in the Admin catalog view. */
  readonly owner: string;
  /** English, Admin-facing only. Never rendered to an employee. */
  readonly description?: string;
}

// --- payload helpers ---------------------------------------------------------
// The payload is `JsonValue` as recorded by whichever feature emitted it, so
// every accessor is defensive: a missing or wrongly-typed field yields
// undefined rather than throwing. A body function that throws degrades to a
// title-only notification (contract §Shape) — it never drops the event.

function str(payload: JsonValue, key: string): string | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const value = (payload as Record<string, JsonValue>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** `entityId` when it names a Work Item, else undefined. */
function workItemIdOf(ctx: CatalogContext): string | undefined {
  return ctx.workItemId ?? (ctx.entityId || undefined);
}

/**
 * 013's rejection reason, when the emitter recorded one. 013's `notify`
 * payload carries `returnId` and `orderId`; the human-readable explanation
 * lives on the Return, which 053 does not read (a Notification is a pointer,
 * and joining the Reason table on the read path would make the bell a
 * relation — research.md §recipients are resolved at processing time). The
 * title alone is therefore what 053 guarantees for a rejection; 013's reason
 * reaches the designer through the deep link, which opens that Return.
 */
function rejectionReason(ctx: CatalogContext): string | undefined {
  return str(ctx.payload, "explanation") ?? str(ctx.payload, "note");
}

// --- the catalog -------------------------------------------------------------

const DESIGN_LINK = (ctx: CatalogContext) =>
  workItemIdOf(ctx) ? `/design/${workItemIdOf(ctx)}` : null;
const PRODUCTION_LINK = (ctx: CatalogContext) =>
  workItemIdOf(ctx) ? `/production/${workItemIdOf(ctx)}` : null;
const ORDER_LINK = (ctx: CatalogContext) =>
  (ctx.orderId ?? str(ctx.payload, "orderId"))
    ? `/orders/${ctx.orderId ?? str(ctx.payload, "orderId")}`
    : null;

/** `payload.assigneeId` — the explicit-user mode 012/013/014 already use. */
const ASSIGNEE = (ctx: CatalogContext): RecipientSpec => {
  const assigneeId = str(ctx.payload, "assigneeId");
  return { userIds: assigneeId ? [assigneeId] : [] };
};

/**
 * The single department of the Work Item the event is about. The payload
 * carries it; 053 does not re-query the Work Item to find it, because the
 * notification is a statement about a moment (research.md §recipients are
 * resolved at processing time).
 */
const WORK_ITEM_DEPARTMENT = (ctx: CatalogContext): RecipientSpec => {
  const departmentId = str(ctx.payload, "departmentId");
  return { departmentIds: departmentId ? [departmentId] : [] };
};

/** Every entry, in one flat table. Order is presentational only. */
const ENTRIES: readonly CatalogEntry[] = [
  // --- 002: the trigger ---------------------------------------------------
  {
    type: "work_item.state_changed",
    aliases: ["workitem.state_changed"],
    // 002 emits this on EVERY transition with an empty recipient list — the
    // highest-volume event in the system. Delivering it verbatim would bury
    // the signal; instead 053 derives the four useful entries below
    // (research.md §Decision: state_changed is a trigger).
    delivery: "TRIGGER",
    title: "",
    recipients: {},
    severity: "INFO",
    owner: "002",
    description: "Work Item state transition. Derives other entries; never delivered itself.",
  },

  // --- 012 / 013 / 014: already in the outbox today -----------------------
  {
    type: "workitem.assigned",
    aliases: ["work_item.assigned"],
    delivery: "DIRECT",
    title: "مهمة جديدة",
    recipients: ASSIGNEE,
    entity: "WorkItem",
    link: DESIGN_LINK,
    severity: "ACTION",
    owner: "012",
    description: "A designer was assigned a Work Item.",
  },
  {
    type: "workitem.rejected",
    aliases: ["work_item.rejected"],
    delivery: "DIRECT",
    title: "تم رفض التصميم",
    body: (ctx) => {
      const reason = rejectionReason(ctx);
      return reason ? `سبب الرفض: ${reason}` : "";
    },
    recipients: ASSIGNEE,
    entity: "WorkItem",
    link: DESIGN_LINK,
    severity: "ACTION",
    owner: "013, 014",
    description: "A design was rejected and returned to design.",
  },
  {
    type: "workitem.production_file_revised",
    aliases: ["work_item.production_file_revised"],
    delivery: "DIRECT",
    title: "تم تحديث ملف الإنتاج",
    recipients: WORK_ITEM_DEPARTMENT,
    entity: "WorkItem",
    link: PRODUCTION_LINK,
    severity: "ACTION",
    owner: "014",
    description: "A newer approved file exists while production is running.",
  },

  // --- 016: spec only, no compile-time import (constitution VII) ----------
  //
  // DEVIATION from contracts/event-catalog.md, recorded rather than absorbed:
  // that table addresses 016's change events at `change.approve`, but that key
  // is NOT among 001's 22 frozen permission keys, and 053 adds none
  // (constitution VI; T014's contract test asserts every catalog Permission is
  // in ALL_PERMISSIONS, so `change.approve` would fail the build). The
  // authority that can approve a change is Admin/Owner in the shipped matrix,
  // so `admin.override` is the honest existing key. When 016 lands and wants a
  // narrower audience, it should either reuse an existing key or request a 001
  // amendment — a key 053 invents here would not be part of the frozen
  // vocabulary and would be invisible to 001's own audit screen.
  ...(
    [
      ["work_item.spec_changed", "تم تحديث المواصفات", ["design.work"], "ACTION"],
      ["work_item.customer_modification", "تعديل من العميل على المواصفات", ["design.review"], "ACTION"],
      ["work_item.change_requested", "طلب تعديل على شغل", ["admin.override"], "ACTION"],
      ["work_item.revised_instruction", "تعليمات إنتاج معدّلة", ["production.operate"], "ACTION"],
      ["work_item.change_rejected", "تم رفض طلب التعديل", ["admin.override"], "ACTION"],
      ["work_item.change_withdrawn", "تم سحب طلب التعديل", ["admin.override"], "ACTION"],
      ["work_item.customer_change_returned", "تم إرجاع العمل للتعديل", ["design.work"], "ACTION"],
      ["work_item.late_cancelled", "تم إلغاء العمل", [], "ACTION"],
    ] as const
  ).map(
    ([type, title, permissions, severity]): CatalogEntry => ({
      type,
      aliases: [type.replace("work_item.", "workitem.")],
      delivery: "DIRECT",
      title,
      recipients: { permissions: [...permissions] },
      entity: "WorkItem",
      link: ORDER_LINK,
      severity,
      owner: "016",
      description: "Change-control event.",
    }),
  ),

  // --- 015: collection -----------------------------------------------------
  {
    type: "order.ready_for_collection",
    delivery: "DIRECT",
    title: "الطلب جاهز للاستلام",
    recipients: { roles: ["RECEPTION", "PRINT_RECEPTION_DELIVERY"] },
    entity: "Order",
    link: ORDER_LINK,
    severity: "ACTION",
    owner: "015",
    description: "Every Work Item on the order is ready for collection.",
  },
  {
    type: "discrepancy.major",
    delivery: "DIRECT",
    title: "فروقات إنتاج كبيرة",
    recipients: { roles: ["ADMIN_OWNER"] },
    entity: "Order",
    link: ORDER_LINK,
    severity: "URGENT",
    owner: "015",
    description: "A major production discrepancy was recorded.",
  },
  {
    type: "compensation.monetary_recorded",
    delivery: "DIRECT",
    title: "تم تسجيل تسوية مالية",
    recipients: { roles: ["ACCOUNTING", "ADMIN_OWNER"] },
    entity: "Compensation",
    link: ORDER_LINK,
    severity: "ACTION",
    owner: "015",
    description: "A monetary compensation was recorded against the order.",
  },
  {
    type: "customer.ready_for_collection",
    delivery: "RECORDED_ONLY",
    // Processed so the outbox drains, but never displayed internally: the
    // recipient is the customer, not a user. 054 reads the same outbox row
    // for the customer-facing message (FR-064's boundary in practice).
    title: "",
    recipients: {},
    severity: "INFO",
    owner: "015, 054",
    description: "Recorded for 054's customer-facing message. Never shown internally.",
  },

  // --- 091: ops alerts, in-app only, never routed to WhatsApp ------------
  ...(
    [
      ["ops.backup.failed", "فشل النسخ الاحتياطي"],
      ["ops.backup.missed", "تم تفويت موعد النسخ الاحتياطي"],
      ["ops.backup.verify_failed", "فشل التحقق من النسخ الاحتياطي"],
      ["ops.disk.low", "مساحة القرص منخفضة"],
      ["ops.disk.critical", "مساحة القرص حرجة"],
      ["ops.ups.shutdown", "انقطاع الكهرباء المفاجئ"],
    ] as const
  ).map(
    ([type, title]): CatalogEntry => ({
      type,
      delivery: "DIRECT",
      title,
      recipients: { permissions: ["admin.config"] },
      entity: "None",
      link: () => "/admin/audit",
      severity: "URGENT",
      owner: "091",
      description: "Operational alert. In-app only — 053 never routes to an external channel.",
    }),
  ),

  // --- 053-derived from work_item.state_changed (PRD §38) ----------------
  {
    type: "work_item.awaiting_review",
    delivery: "DIRECT",
    title: "تصميم جديد بانتظار المراجعة",
    recipients: { permissions: ["design.review"] },
    entity: "WorkItem",
    link: DESIGN_LINK,
    severity: "ACTION",
    owner: "053 (derived)",
    description: "A Work Item entered WAITING_REVIEW.",
  },
  {
    type: "work_item.ready_for_production",
    delivery: "DIRECT",
    title: "شغل جاهز للإنتاج",
    recipients: WORK_ITEM_DEPARTMENT,
    entity: "WorkItem",
    link: PRODUCTION_LINK,
    severity: "ACTION",
    owner: "053 (derived)",
    description: "A Work Item entered READY_FOR_PRODUCTION.",
  },
  {
    type: "work_item.production_started",
    delivery: "DIRECT",
    title: "بدء التنفيذ في الإنتاج",
    recipients: WORK_ITEM_DEPARTMENT,
    entity: "WorkItem",
    link: PRODUCTION_LINK,
    severity: "INFO",
    owner: "053 (derived)",
    description: "A Work Item entered IN_PRODUCTION.",
  },
  {
    type: "work_item.urgent",
    delivery: "DIRECT",
    title: "شغل عاجل",
    recipients: WORK_ITEM_DEPARTMENT,
    entity: "WorkItem",
    link: PRODUCTION_LINK,
    severity: "URGENT",
    owner: "053 (derived)",
    description: "A Work Item entered a production-side state on an URGENT order.",
  },

  // --- 053 scheduler: delay detection (PRD §27 / §50) --------------------
  {
    type: "work_item.phase_delayed",
    delivery: "DIRECT",
    title: "شغل متأخر",
    recipients: {},
    entity: "WorkItem",
    severity: "ACTION",
    owner: "053 (scheduler)",
    description: "A Work Item exceeded its phase threshold. One alert per breach.",
  },
  {
    type: "work_item.pricing_delayed",
    delivery: "DIRECT",
    // PRD §27 verbatim: the shop sees this exact wording in reception,
    // accounting, and the owner's queue alike.
    title: "تسعير معلق",
    recipients: {},
    entity: "WorkItem",
    severity: "URGENT",
    owner: "053 (scheduler)",
    description: "Pricing has been pending or disputed past the pricing threshold.",
  },
  {
    type: "work_item.phase_delayed_escalated",
    delivery: "DIRECT",
    title: "تأخير متكرر",
    recipients: {},
    entity: "WorkItem",
    severity: "URGENT",
    owner: "053 (scheduler)",
    description: "Escalation tier fired. Accepted and stored in V1 but not yet raised.",
  },

  // --- entries 053 owns, other features raise (PRD §38) -------------------
  {
    type: "work_item.repeated_rejection",
    delivery: "DIRECT",
    title: "رفض متكرر على نفس الشغل",
    recipients: { roles: ["ADMIN_OWNER"] },
    entity: "WorkItem",
    link: DESIGN_LINK,
    severity: "ACTION",
    owner: "013 (raised), 053 (entry)",
    description: "013 decides what counts as repeated; 053 supplies the entry.",
  },
  {
    type: "operational.anomaly",
    delivery: "DIRECT",
    title: "شذوذ تشغيلي",
    recipients: { roles: ["ADMIN_OWNER"] },
    entity: "None",
    severity: "URGENT",
    owner: "090 (raised), 053 (entry)",
    description: "090's anomaly detection raises it. Catalog entry ships first.",
  },
] as const;

/** Every entry, for the Admin catalog view and the catalog contract test. */
export const CATALOG: readonly CatalogEntry[] = ENTRIES;

const BY_TYPE: ReadonlyMap<string, CatalogEntry> = (() => {
  const map = new Map<string, CatalogEntry>();
  for (const entry of ENTRIES) {
    map.set(entry.type, entry);
    for (const alias of entry.aliases ?? []) {
      // An alias collision would silently merge two entries, so it is a
      // hard startup failure rather than a last-write-wins map.
      const existing = map.get(alias);
      if (existing && existing.type !== entry.type) {
        throw new Error(
          `Notification catalog: alias "${alias}" is claimed by both "${existing.type}" and "${entry.type}"`,
        );
      }
      map.set(alias, entry);
    }
  }
  return map;
})();

/**
 * The emitter-facing constants. `Events.assigned` rather than the string
 * `"workitem.assigned"` — a literal in a feature is a review finding
 * (contract §Rules for emitters).
 */
export const Events = {
  stateChanged: "work_item.state_changed",
  assigned: "workitem.assigned",
  rejected: "workitem.rejected",
  productionFileRevised: "workitem.production_file_revised",
  specChanged: "work_item.spec_changed",
  customerModification: "work_item.customer_modification",
  changeRequested: "work_item.change_requested",
  revisedInstruction: "work_item.revised_instruction",
  changeRejected: "work_item.change_rejected",
  changeWithdrawn: "work_item.change_withdrawn",
  customerChangeReturned: "work_item.customer_change_returned",
  lateCancelled: "work_item.late_cancelled",
  orderReadyForCollection: "order.ready_for_collection",
  discrepancyMajor: "discrepancy.major",
  compensationMonetaryRecorded: "compensation.monetary_recorded",
  customerReadyForCollection: "customer.ready_for_collection",
  opsBackupFailed: "ops.backup.failed",
  opsBackupMissed: "ops.backup.missed",
  opsBackupVerifyFailed: "ops.backup.verify_failed",
  opsDiskLow: "ops.disk.low",
  opsDiskCritical: "ops.disk.critical",
  opsUpsShutdown: "ops.ups.shutdown",
  awaitingReview: "work_item.awaiting_review",
  readyForProduction: "work_item.ready_for_production",
  productionStarted: "work_item.production_started",
  urgent: "work_item.urgent",
  phaseDelayed: "work_item.phase_delayed",
  pricingDelayed: "work_item.pricing_delayed",
  phaseDelayedEscalated: "work_item.phase_delayed_escalated",
  repeatedRejection: "work_item.repeated_rejection",
  operationalAnomaly: "operational.anomaly",
} as const;

/** Canonical type for `type`, by canonical name or alias. Undefined if unknown. */
export function canonicalType(type: string): string | undefined {
  return BY_TYPE.get(type)?.type;
}

/** The entry for `type` (canonical or alias), or `undefined` when unknown. */
export function lookup(type: string): CatalogEntry | undefined {
  return BY_TYPE.get(type);
}

/** Every spelling that reaches `type` — the page's filter expands to these. */
export function spellingsOf(type: string): string[] {
  const entry = BY_TYPE.get(type);
  if (!entry) return [type];
  return [entry.type, ...(entry.aliases ?? [])];
}

/** Every canonical type, for the notifications page's type filter. */
export function canonicalTypes(): string[] {
  return ENTRIES.map((entry) => entry.type);
}

/** The entry's default recipients, evaluating it if it is a function. */
export function defaultRecipients(entry: CatalogEntry, ctx: CatalogContext): RecipientSpec {
  return typeof entry.recipients === "function" ? entry.recipients(ctx) : entry.recipients;
}

export interface RenderedEntry {
  readonly title: string;
  readonly body: string | null;
  readonly linkHref: string | null;
  readonly severity: Severity;
}

/**
 * Produces the captured content for a notification.
 *
 * A body or link function that throws degrades to a title-only notification
 * rather than dropping the event: a notification with a missing reason is
 * still a correct notification ("your design was rejected"), whereas losing
 * the notification entirely means the designer never learns at all
 * (contract §Shape, spec Edge Cases).
 */
export function renderEntry(entry: CatalogEntry, ctx: CatalogContext): RenderedEntry {
  let body: string | null = null;
  if (entry.body) {
    try {
      const rendered = entry.body(ctx);
      body = rendered.length > 0 ? rendered : null;
    } catch {
      body = null;
    }
  }

  let linkHref: string | null = null;
  if (entry.link) {
    try {
      linkHref = entry.link(ctx);
    } catch {
      linkHref = null;
    }
  }

  return { title: entry.title, body, linkHref, severity: entry.severity };
}

/** Recipients for `type`, degrading to `{}` when the spec function throws. */
export function recipientsFor(entry: CatalogEntry, ctx: CatalogContext): RecipientSpec {
  try {
    return defaultRecipients(entry, ctx);
  } catch {
    return {};
  }
}
