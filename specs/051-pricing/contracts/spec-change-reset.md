# Contract: Specification-Change Pricing Reset

051 consumes 016's listener API:

```ts
registerSpecChangeListener("pricing.reset", async (event, tx) => {
  // reset affected WorkItem pricing using tx only
});
```

## Obligations

- Register once from the pricing barrel/boot path; replace duplicate registration by name in tests/hot reload.
- Handle every accepted `SPEC_CHANGED` event affecting a priced or pending WorkItem.
- Set PricingStatus to `PENDING`, set/retain `waitingSince`, clear the current-price association, and record the affected specification version.
- Keep historical WorkItemPrice records unchanged.
- Write `pricing.reset_after_spec_change` through 001 audit using the supplied transaction.
- Do not open a nested transaction, perform external I/O, or call UI code.
- Throw only typed veto errors understood by 016; unexpected errors must propagate and roll back the outer change transaction.
- A numeric price that happens to be unchanged still resets because the specification explanation changed.

## Test obligations

The implementation tasks must exercise a real 016 change path when 016 is available, plus a contract-level listener test with a supplied transaction. Tests must prove both successful reset and rollback on listener failure.
