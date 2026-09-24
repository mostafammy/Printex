# Contracts: Consumer-Owned Ports & Outbox Events (cross-team, Track B)

Owner of these interfaces: **015 (consumer)**. Implementers: 051 (pricing), 052 (finance), 050
(files/attachments). Consumer of the outbox events: 053/054. Each item below needs explicit
agreement from the Track B owner before 015's implementation merges; until a provider binds its
port, the default adapter in the right-hand column is used.

All ports are exported (types + `bind…` functions) from `~/server/collection`. A provider binds
**once** at module load of its own barrel (the same side-effect pattern as 013's
`import "./guards"`); binding twice throws `PORT_ALREADY_BOUND`. The shared `src/instrumentation.ts` boot hook
(research.md §4) `await import`s the provider barrels, alongside its `registerXGuards()` calls, so that
bindings exist before the first request. Each provider adds its own line to that file.

## 1. `PricingGatePort` — implemented by 051

```ts
export type PricingResponsible = { readonly label: string; readonly userIds: readonly string[] };

export type PricingStatus =
  | { readonly status: "RESOLVED" }
  | { readonly status: "NOT_REQUIRED" }
  | { readonly status: "PENDING"; readonly waitingSince: Date | null; readonly responsible: PricingResponsible };

export interface PricingGatePort {
  /** Batched; MUST return an entry for every requested id. Read-only, no side effects. */
  getPricingStatus(workItemIds: readonly string[]): Promise<ReadonlyMap<string, PricingStatus>>;
}

export function bindPricingGatePort(port: PricingGatePort): void;
```

| Aspect | Agreement needed |
|---|---|
| Default (unbound) | every id → `PENDING`, `waitingSince: null`, `responsible.label = "Pricing module not connected — contact Admin/Owner"` (fail closed, spec Clarifications) |
| Price adjustments | 051 MUST return `PENDING` for a Work Item while any `PRICE_ADJUSTMENT` compensation on it (`listCompensationsForOrder`) has not been applied by 051 |
| Reprints | proposal: a Work Item with `reprintOfWorkItemId != null` is `NOT_REQUIRED` (no charge) unless a pricing user explicitly prices it — **051 to confirm** |
| Responsible | `label` names the role/users to ask (e.g. "Accounting — Samir"), `userIds` the configured pricing users (PRD §26/§27) |
| Guard | 015 owns the guard on `READY_FOR_COLLECTION → DELIVERED`; 051 MUST NOT register a second guard on that edge (research.md §4) |
| Consistency | reads committed data; called outside 015's transaction for the pre-check and by the guard (no `tx` in `GuardContext`) |

## 2. `FinanceSummaryPort` — implemented by 052

```ts
export type OrderFinanceSummary =
  | {
      readonly status: "AVAILABLE";
      readonly currency: "EGP";
      readonly total: Prisma.Decimal;
      readonly paid: Prisma.Decimal;
      readonly remaining: Prisma.Decimal;   // total - paid - applied credits; may be <= 0
      readonly creditApproved: boolean;     // customer/order covered by approved credit policy (PRD §22)
    }
  | { readonly status: "UNAVAILABLE"; readonly reason: string };

export interface FinanceSummaryPort {
  orderSummary(orderId: string): Promise<OrderFinanceSummary>;
}

export function bindFinanceSummaryPort(port: FinanceSummaryPort): void;
```

| Aspect | Agreement needed |
|---|---|
| Default (unbound) | `{ status: "UNAVAILABLE", reason: "Finance module not connected" }` → delivery sheet shows it; closure unmet `FINANCE_UNAVAILABLE` |
| Credits | 052 applies `CREDIT` compensations (read via `listCompensationsForOrder`) to `remaining` |
| Cash customer | `creditApproved` MUST be `false` for the built-in Cash Customer |
| Closure trigger | after 052's payment transaction **commits**, 052 calls `tryFinancialClosure(actor, orderId)` from `~/server/collection` (not inside its tx — research.md §5); a `closed: false` result is not an error |
| Visibility | 015 shows total/paid/remaining/creditApproved to `delivery.record` holders (spec Clarifications) — 052 to confirm this is acceptable |

## 3. `DiscrepancyAttachmentPort` — implemented by 050

```ts
export type StagedAttachment = { readonly stagingId: string; readonly kind: "voice" | "image" | "file";
  readonly fileName: string; readonly sizeBytes: number; readonly sha256: string };

export interface DiscrepancyAttachmentPort {
  readonly available: boolean;
  /** Called BEFORE any transaction: streams bytes to storage, validates MIME/size. */
  stage(input: { kind: "voice" | "image" | "file"; fileName: string; mimeType?: string;
    stream: NodeJS.ReadableStream; actorId: string }): Promise<StagedAttachment>;
  /** Called INSIDE 015's transaction: creates the Attachment row linked polymorphically. */
  commit(tx: Prisma.TransactionClient, staged: StagedAttachment,
    link: { entityType: "Discrepancy"; entityId: string }): Promise<{ attachmentId: string }>;
}

export function bindDiscrepancyAttachmentPort(port: DiscrepancyAttachmentPort): void;
```

| Aspect | Agreement needed |
|---|---|
| Default (unbound) | `available: false`; UI hides attachment inputs; `files` non-empty → `ATTACHMENTS_UNAVAILABLE` |
| Shape vs 050 today | 050's `attachments.attach(tx, { entityType, entityId, stream, fileName, kind })` streams inside `tx`; 012/013 deliberately write bytes before the tx. Ask 050 to expose stage/commit (or accept that 015's adapter stages via 050's storage and commits via `attach` metadata) |
| Orphans | staged-but-never-committed bytes (tx rolled back) are 050's cleanup concern |
| Authorization | entity ownership authorization stays with 015 (050 contract: "Entity ownership authorization remains with the consuming feature"); reads of discrepancy attachments require `collection.receive`, `delivery.record` or `audit.view` |
| Audit | 015 puts the returned `attachmentId`s into `AuditEvent.attachmentIds` of `discrepancy.recorded` |

## 4. Outbox events (002 `notify()` → `NotificationEvent`) — consumed by 053/054

All written in the same transaction as the triggering change. 015 never writes
`deliveredAt`/`deliveryStatus`.

| `type` | `entity` | `recipients` | `payload` |
|---|---|---|---|
| `customer.ready_for_collection` | `{ type: "Order", id: orderId }` | `{}` (customer is not a user) | `{ templateKey: "ORDER_READY_FOR_COLLECTION", orderId, orderNumber, customerId, mode: "GROUPED" \| "SEPARATE", workItemIds: string[] }` — for 054 |
| `order.ready_for_collection` | `{ type: "Order", id }` | `{ roles: policy.readyNoticeRoles }` | `{ orderId, orderNumber, workItemIds }` — internal (PRD §38 Reception "Order ready") |
| `discrepancy.major` | `{ type: "WorkItem", id }` | `{ roles: policy.majorDiscrepancyNotifyRoles }` | `{ orderId, orderNumber, workItemId, expected, nonAccepted, percent, discrepancyIds }` (PRD §38 Owner "Major discrepancy") |
| `compensation.monetary_recorded` | `{ type: "Compensation", id }` | `{ roles: ["ACCOUNTING", ...policy.majorDiscrepancyNotifyRoles] }` | `{ orderId, workItemId, discrepancyId, kind: "CREDIT" \| "PRICE_ADJUSTMENT", amount: string, currency: "EGP" }` |

054 agreement: consumes `customer.ready_for_collection`, resolves the customer's WhatsApp number
itself (payload deliberately carries no phone), applies Meta template policy (PRD §37), retries
per constitution VII. If 054 prefers staff confirmation before sending, that is 054's UX; 015 still
records the request exactly once per readiness flip (SC-007).

## 5. Integration read — `listCompensationsForOrder(orderId)`

See contracts/collection.md. Consumed by 051 (pending price adjustments) and 052 (credits). No
actor; the caller authorizes its own entry point.
