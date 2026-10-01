# Contract: Pipeline Transitions

Single authority: `transitionWorkItem(tx, input)` — the only writer of `WorkItem.state`.

```ts
type PipelineEdge =
  | { from: "NEW"; to: "ASSIGNED" }                       // reception releases (designer required)
  | { from: "ASSIGNED"; to: "IN_DESIGN" }                 // designer starts
  | { from: "IN_DESIGN"; to: "DESIGN_COMPLETED" }         // designer completes (file required)
  | { from: "DESIGN_COMPLETED"; to: "WAITING_PRICING" }   // handoff to accountant
  | { from: "WAITING_PRICING"; to: "READY_FOR_PRODUCTION" } // accountant approves → printer (ROLL class)
  | { from: "WAITING_PRICING"; to: "WAITING_REVIEW" }     // non-ROLL classes only (requiresReview = true)
  | { from: "WAITING_REVIEW"; to: "APPROVED" }            // Head Designer approval (≠ author), non-ROLL only
  | { from: "APPROVED"; to: "READY_FOR_PRODUCTION" }      // non-ROLL classes only
  | { from: "*"; to: "REWORK_REQUIRED" }                  // via Return only, reason + category required
  | { from: "*"; to: "CANCELLED" };                       // via Void/Cancel only, reason required
```

Guards per edge (server-side, all must pass or the call fails with a typed error and no write):
- NEW→ASSIGNED: caller reception/manager; `assigneeId` present and designer-eligible; dimensions + rates valid; open WidthException (if any) resolved.
- →DESIGN_COMPLETED: caller is assignee; ≥1 valid DesignVersion/FileVersion owned by workItem exists; stores `designerFileVersionId` + timestamp.
- WAITING_PRICING→READY_FOR_PRODUCTION (ROLL class, `requiresReview = false`): caller has pricing/finance scope; dimensions, area, frozen rates, totals, and file all present and consistent; stores `accountantApprovedAt/By`.
- WAITING_REVIEW→APPROVED (non-ROLL classes only): caller is Head Designer and ≠ uploader (013 no-self-approval). Attempting this edge on a `requiresReview = false` item is refused as an illegal transition.
- Any →READY_FOR_PRODUCTION/IN_PRODUCTION edge from NEW, ASSIGNED, IN_DESIGN, or DESIGN_COMPLETED: edge does not exist → `ILLEGAL_TRANSITION`.
- Every success writes `WorkItemTransition` + audit event in the same transaction.

Forbidden-edge tests (server path): DESIGNER→PRINTER, DESIGN_COMPLETED→READY_FOR_PRODUCTION without accountant approval, unassigned NEW→ASSIGNED, file-less completion, non-accountant approval, self-approval, cross-role calls — all must fail with no state change.
