# Contract: Notification Outbox

Owner: 002 (this feature, recording only). Consumer for delivery: 053 (internal
notifications/WhatsApp delivery). Consumer for recording: any feature that causes something a user
should be told about (transitionWorkItem calls this internally; 010/024–028 may call it directly
for events outside the state machine, e.g. a new customer-specific price list).

## `notify`

```ts
function notify(
  tx: PrismaTransactionClient,
  event: {
    type: string;                 // e.g. "work_item.rejected", "work_item.state_changed"
    entity: { type: string; id: string };
    recipients: {
      userIds?: string[];
      roles?: string[];
      departmentIds?: string[];
    };
    payload?: Record<string, unknown>;
  }
): Promise<void>;
```

- Writes one `NotificationEvent` row inside the caller's `tx` — never opens its own transaction,
  never delivers anything itself.
- `recipients` MAY combine `userIds`, `roles`, and `departmentIds`; resolving that to an actual
  recipient list is 053's job at delivery time, not this feature's.
- `type` is a free-form string namespaced by dot (`<entity>.<event>`); this feature does not
  enumerate an exhaustive list — each caller defines its own event types as needed. Track A/B
  SHOULD document the types they emit in their own spec's contracts, referencing this shape.

## Rules for consumers

- Always pass the same `tx` the triggering write used — an event recorded outside that transaction
  could reference a state change that gets rolled back, violating constitution VII's "failed
  outbound actions MUST be queued/retried, not lost" (there would be nothing to retry if the
  underlying event never actually happened).
- Do not build a second outbox table for a new feature's events — reuse `NotificationEvent`.
- `deliveredAt`/`deliveryStatus` on the row are reserved for 053; no other feature should write to
  them.
