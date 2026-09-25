# Contract: Event Catalog

Owner: 053. Public module `~/server/notifications/catalog` (exported from the `~/server/notifications`
barrel). This is the **single shared vocabulary** of notification event types. Emitters reference a constant
from here; they never write a string literal. The UI renders titles and bodies from here; it never hard-codes
one either. One catalog, one spelling of every event (spec FR-011).

## Shape

```ts
type CatalogEntry = {
  readonly type: string;                    // canonical type — the key
  readonly aliases?: readonly string[];     // other spellings that map here (research.md §4)
  readonly delivery: "DIRECT" | "TRIGGER" | "RECORDED_ONLY";
  // TRIGGER derives other entries and is never itself delivered.
  // RECORDED_ONLY is processed (so the outbox drains) but produces no notification —
  // the only current instance is customer.ready_for_collection, whose audience is the
  // customer, not a user. 054 reads the same outbox for the customer-facing message.
  readonly title: string;                   // Arabic, captured onto the notification
  readonly body?: (ctx: CatalogContext) => string;  // Arabic; may return "" for title-only entries
  readonly recipients: RecipientSpec;       // the DEFAULT recipient specification
  readonly entity?: "WorkItem" | "Order" | "Customer" | "Compensation" | "None";
  readonly link?: (ctx: CatalogContext) => string | null;  // deep link, resolved at processing time
  readonly severity: "INFO" | "ACTION" | "URGENT";
  readonly owner: string;                   // the feature that emits it, for the Admin catalog view
  readonly description?: string;            // English, Admin-facing only
};

type CatalogContext = {
  readonly payload: JsonValue;              // the outbox event's payload, as recorded
  readonly entityId: string | null;
  readonly orderId?: string | null;
  readonly workItemId?: string | null;
};
```

Recipients may be a **function** of the context, not only a constant — a derived entry needs the assignee
from the payload, not a fixed role list. A function that throws degrades to a title-only notification; it
never drops the event (spec Edge Cases).

## The catalog

### Emitted by shipped features (already in the outbox today)

| Canonical type | Aliases | Owner | Delivery | Arabic title | Recipients (default) | Link |
|---|---|---|---|---|---|---|
| `work_item.state_changed` | `workitem.state_changed` | 002 | **TRIGGER** | — (never delivered) | — | — |
| `workitem.assigned` | `work_item.assigned` | 012 | DIRECT | مهمة جديدة | `payload.assigneeId` (explicit user) | `/design/[workItemId]` |
| `workitem.rejected` | `work_item.rejected` | 013, 014 | DIRECT | تم رفض التصميم | `payload.assigneeId` | `/design/[workItemId]` |
| `workitem.production_file_revised` | `work_item.production_file_revised` | 014 | DIRECT | تم تحديث ملف الإنتاج | department of the Work Item | `/production/[workItemId]` |
| `work_item.spec_changed` | `workitem.spec_changed` | 016 | DIRECT | تم تحديث المواصفات | assignee + effective department | `/orders/[orderId]` |
| `work_item.customer_modification` | `workitem.customer_modification` | 016 | DIRECT | تعديل من العميل على المواصفات | assignee (+ `design.review` holders in `WAITING_REVIEW`) | `/orders/[orderId]` |
| `work_item.change_requested` | `workitem.change_requested` | 016 | DIRECT | طلب تعديل على شغل | effective department + `change.approve` | `/orders/[orderId]` |
| `work_item.revised_instruction` | `workitem.revised_instruction` | 016 | DIRECT | تعليمات إنتاج معدّلة | effective department | `/orders/[orderId]` |
| `work_item.change_rejected` | `workitem.change_rejected` | 016 | DIRECT | تم رفض طلب التعديل | requester + department | `/orders/[orderId]` |
| `work_item.change_withdrawn` | `workitem.change_withdrawn` | 016 | DIRECT | تم سحب طلب التعديل | requester + department | `/orders/[orderId]` |
| `work_item.customer_change_returned` | `workitem.customer_change_returned` | 016 | DIRECT | تم إرجاع العمل للتعديل | assignee | `/design/[workItemId]` |
| `work_item.late_cancelled` | `workitem.late_cancelled` | 016 | DIRECT | تم إلغاء العمل | order creator + department | `/orders/[orderId]` |
| `order.ready_for_collection` | — | 015 | DIRECT | الطلب جاهز للاستلام | `policy.readyNoticeRoles` | `/orders/[orderId]` |
| `discrepancy.major` | — | 015 | DIRECT | فروقات إنتاج كبيرة | `policy.majorDiscrepancyNotifyRoles` (default `ADMIN_OWNER`) | `/orders/[orderId]` |
| `compensation.monetary_recorded` | — | 015 | DIRECT | تم تسجيل تسوية مالية | `ACCOUNTING` + discrepancy roles | `/orders/[orderId]` |
| `customer.ready_for_collection` | — | 015 | **RECORDED ONLY** | — | — (customer is not a user) | — |
| `ops.backup.failed` / `.missed` / `.verify_failed` | — | 091 | DIRECT | per `ar.json` `ops.alert.<type>` via `messageKey` | `admin.config` | `/admin/audit` |
| `ops.disk.low` / `.critical` / `ops.ups.shutdown` | — | 091 | DIRECT | per `messageKey` | `admin.config` | `/admin/audit` |

`customer.ready_for_collection` is **recorded and processed but never displayed in the internal center** —
the customer is not a user. 053 marks it processed (so the outbox drains) and produces no notification.
054 reads the same outbox for the customer-facing message. This is FR-064's boundary in practice.

### Derived by 053 from `work_item.state_changed` (PRD §38 entries no feature emits today)

| Canonical type | Triggered when | Arabic title | Recipients | Severity |
|---|---|---|---|---|
| `work_item.awaiting_review` | `to === "WAITING_REVIEW"` | تصميم جديد بانتظار المراجعة | `design.review` permission holders | ACTION |
| `work_item.ready_for_production` | `to === "READY_FOR_PRODUCTION"` | شغل جاهز للإنتاج | the Work Item's department members | ACTION |
| `work_item.production_started` | `to === "IN_PRODUCTION"` | بدء التنفيذ في الإنتاج | the Work Item's department members | INFO |
| `work_item.urgent` | `to` is any production-side state **and** the order is `URGENT` | شغل عاجل | department members + `RECEPTION` | URGENT |

An urgent Work Item can produce two notifications on one transition (`ready_for_production` + `urgent`).
That is intended: the operator and reception have different reasons to care, and both are PRD §38 entries.
The `@@unique([sourceEventId, userId])` pair is per (event, user) — a user who is both the department member
and reception receives **one** notification, resolved to the higher severity.

### Emitted by the scheduler (delay detection, PRD §27/§50)

| Canonical type | Arabic title | Body | Recipients | Severity |
|---|---|---|---|---|
| `work_item.phase_delayed` | شغل متأخر | `الانتظار: {age}` + phase name | the phase's `DelayThreshold` recipients | ACTION |
| `work_item.pricing_delayed` | تسعير معلق | `تسعير معلق — منتظر منذ {age}` (PRD §27's exact wording) | the pricing phase's `DelayThreshold` recipients | URGENT |
| `work_item.phase_delayed_escalated` | تأخير متكرر | `الانتظار: {age}` + phase name | same recipients | URGENT |

The pricing title/body are PRD §27 verbatim: the PRD specifies the literal display
`Pricing Pending / Waiting Since: 2h 14m`, and the Arabic rendering is fixed in `ar.json` so reception,
accounting, and the owner all see the same wording. Ages are rendered by one shared formatter
(`{age}` → `2h 14m` / `٣س ١٤د`) so the same age never renders two ways on two screens.

### Owned by 053 for other features to raise (PRD §38, no emitter today)

| Canonical type | Arabic title | Recipients | Raised by | Severity |
|---|---|---|---|---|
| `work_item.repeated_rejection` | رفض متكرر على نفس الشغل | assignee + `ADMIN_OWNER` | 013 (which decides what counts as repeated) | ACTION |
| `operational.anomaly` | شذوذ تشغيلي | `ADMIN_OWNER` | 090 (anomaly detection, Phase 2) | URGENT |

053 provides the entry and the recipient resolution; the raising side belongs to the owning feature. These
are catalog entries with no emitter today — the Admin catalog view marks them "no emitter" so the gap is
visible rather than assumed covered (spec FR-019 spirit).

## Rules for emitters

- **Reference the constant.** `import { Events } from "~/server/notifications"` then
  `notify(tx, { type: Events.assigned, … })`. A string literal in a feature is a review finding.
- **New types go here first.** A type with no entry is processed and recorded but never displayed
  (FR-019). If you emit one, add the entry in the same change.
- **One transaction.** Always pass the `tx` the triggering write used (002's rule). An event recorded
  outside that transaction could describe a write that rolled back.
- **Do not write `deliveredAt`, `deliveryStatus`, `attemptCount`, `lastAttemptAt`, or `lastError`.**
  These are 053's processing columns on the outbox row (002 reserved the first two for exactly this);
  the catalog only ever *reads* the recipient and payload data.
  Those five columns belong to 053 exclusively (002's contract reserves them).
- **Recipients are a specification, not a decision.** Emit *who should hear about it*; 053 decides who
  actually does (002's contract hands resolution to 053).
- **Do not build a second outbox.** Reuse `NotificationEvent` (002's contract).

## Compatibility rules

- Aliases are permanent. A type that has shipped may not be removed from the catalog, only aliased onward.
- `work_item.*` is canonical for new events. The `workitem.*` spellings from 012/013/014 stay as aliases
  indefinitely; renaming those emitters is out of 053's scope (research.md §4).
- Removing a catalog entry is a breaking change to every emitter that references it. The Admin catalog view
  lists each entry with its owner and its last-seen time so a stale entry is visible before it is removed.
