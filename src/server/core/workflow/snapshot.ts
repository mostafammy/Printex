// Read-only Work Item projection — plan.md §5.3 (`WorkItemSnapshot`),
// §5.4 ("domain objects are treated as immutable snapshots; a transition
// produces a *new* snapshot, it never mutates one in place").
//
// This is the shape guards inspect (`GuardContext.workItem`) and the shape
// `transitionWorkItem` returns on success — a plain readonly projection of
// the Prisma `WorkItem` row, not a live Prisma entity, so nothing in `core`
// or a guard can accidentally treat it as writable.

import type { OrderId, UserId, WorkItemId } from "../ids";
import type { WorkItemState } from "./states";

export interface WorkItemSnapshot {
  readonly id: WorkItemId;
  readonly orderId: OrderId;
  readonly productTypeId: string | null;
  readonly departmentId: string | null;
  readonly state: WorkItemState;
  readonly requiresDesign: boolean;
  readonly requiresReview: boolean;
  readonly assigneeId: UserId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
