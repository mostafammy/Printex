# Contract: Pricing-Originated Returns

Pricing uses 013's shared transaction helper:

```ts
createReturnInTx(tx, actor, workItemId, {
  originDepartmentId: pricingDepartmentId,
  category: "PRICING_ISSUE",
  assignedToId,
  explanation,
  note,
  designVersionId: undefined,
}, attachments);
```

Rules:

- The explanation is required and must state the pricing problem.
- `originDepartmentId` identifies Pricing, not Design or Production.
- `category` is `PRICING_ISSUE`.
- `designVersionId` is omitted because the return is not a design rejection.
- Authorization belongs to the 051 caller; the helper remains transaction-bound.
- If a workflow transition is also required, 051 composes `transitionWorkItem` and `createReturnInTx` in one caller transaction.
- The mutation is audited and the Return is immutable according to 013's contract.
