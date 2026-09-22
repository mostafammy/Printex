# Contract: Derived Order Status

Owner: 002 (this feature). Consumer: any feature that displays an Order (011's reception queue,
Fady's customer profile view, reporting).

## `deriveOrderStatus`

```ts
type OrderStatusBucket =
  | "NOT_STARTED"
  | "IN_PRODUCTION"
  | "PARTIALLY_READY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

function deriveOrderStatus(
  workItems: Pick<WorkItem, "state">[]
): OrderStatusBucket;
```

- **Pure function** — no database access, no I/O. Safe to call in a React Server Component or in a
  test with a plain array literal.
- Full derivation rule is in [data-model.md](../data-model.md#order-status-derivation-bucket-rule-from-speckit-clarify).
- An Order with zero Work Items is undefined behavior for this function — callers MUST NOT invoke
  it before at least one Work Item exists (constitution I: an Order without Work Items shouldn't
  be displayed as "in progress" of anything).

## Rules for consumers

- Never persist the return value as if it were a database column; call this function at read time,
  every time.
- Do not reimplement this logic elsewhere (e.g. in a report query) — import
  `deriveOrderStatus` from `src/server/core/orders/deriveOrderStatus.ts`. If a reporting feature
  needs this computed in SQL for performance, that is a new decision requiring its own
  Complexity Tracking entry, not a silent duplicate implementation.
