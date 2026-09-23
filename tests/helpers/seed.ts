// Minimal live-DB seed helpers for integration tests (T021-T023) — inserts
// just enough of the Customer -> Order -> WorkItem graph (constitution I)
// for `transitionWorkItem` to operate against, via `testDb`
// (tests/helpers/testDb.ts).

import { testDb } from "./testDb";
import { asCustomerId, asOrderId, asUserId, asWorkItemId } from "~/server/core";
import type { CustomerId, OrderId, UserId, WorkItemId, WorkItemState } from "~/server/core";

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${process.hrtime.bigint().toString()}_${counter}`;
}

export async function seedUser(): Promise<UserId> {
  const id = unique("user");
  const user = await testDb.user.create({
    data: {
      id,
      name: "Test User",
      email: `${id}@example.test`,
      username: id,
    },
  });
  return asUserId(user.id);
}

export async function seedCustomer(): Promise<CustomerId> {
  const customer = await testDb.customer.create({
    data: { name: unique("Customer"), normalizedName: unique("customer") },
  });
  return asCustomerId(customer.id);
}

export async function seedOrder(params: {
  readonly customerId: CustomerId;
  readonly createdById: UserId;
}): Promise<OrderId> {
  const order = await testDb.order.create({
    data: {
      // Order.number is a unique Int; derive a large, effectively-unique
      // value from a high-resolution counter rather than relying on a real
      // sequence (this feature's DB sequence lives in the schema, not
      // something a test factory should try to emulate).
      number: Number(process.hrtime.bigint() % 1_000_000_000n),
      customerId: params.customerId,
      channel: "WALK_IN",
      priority: "NORMAL",
      mode: "GROUPED",
      createdById: params.createdById,
    },
  });
  return asOrderId(order.id);
}

export async function seedWorkItem(params: {
  readonly orderId: OrderId;
  readonly state: WorkItemState;
}): Promise<WorkItemId> {
  const workItem = await testDb.workItem.create({
    data: { orderId: params.orderId, state: params.state },
  });
  return asWorkItemId(workItem.id);
}
