// Test Data Builders (Factory pattern) — plan.md §5.2.
//
// Fluent builders producing minimal valid plain objects (not DB-inserted —
// integration tests in later phases insert these via Prisma as needed).

import {
  asCustomerId,
  asOrderId,
  asWorkItemId,
  asUserId,
  type CustomerId,
  type OrderId,
  type WorkItemId,
  type UserId,
} from "~/server/core/ids";
import type { WorkItemState } from "~/server/core/workflow/states";

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString().padStart(6, "0")}`;
}

// --- Customer ----------------------------------------------------------

export interface CustomerBuild {
  readonly id: CustomerId;
  readonly name: string;
  readonly isCashCustomer: boolean;
  readonly createdAt: Date;
}

export class CustomerBuilder {
  private data: CustomerBuild = {
    id: asCustomerId(nextId("customer")),
    name: "Test Customer",
    isCashCustomer: false,
    createdAt: new Date(),
  };

  withId(id: string): this {
    this.data = { ...this.data, id: asCustomerId(id) };
    return this;
  }

  withName(name: string): this {
    this.data = { ...this.data, name };
    return this;
  }

  cashCustomer(): this {
    this.data = { ...this.data, isCashCustomer: true, name: "Cash Customer" };
    return this;
  }

  build(): CustomerBuild {
    return this.data;
  }
}

export function aCustomer(): CustomerBuilder {
  return new CustomerBuilder();
}

// --- Order ---------------------------------------------------------------

export interface OrderBuild {
  readonly id: OrderId;
  readonly number: number;
  readonly customerId: CustomerId;
  readonly channel: "WALK_IN" | "WHATSAPP" | "PHONE" | "RETURNING" | "DIRECT_TO_DESIGNER";
  readonly priority: "NORMAL" | "URGENT";
  readonly mode: "GROUPED" | "SEPARATE";
  readonly createdById: UserId;
  readonly createdAt: Date;
}

export class OrderBuilder {
  private data: OrderBuild = {
    id: asOrderId(nextId("order")),
    number: counter + 1000,
    customerId: asCustomerId(nextId("customer")),
    channel: "WALK_IN",
    priority: "NORMAL",
    mode: "GROUPED",
    createdById: asUserId(nextId("user")),
    createdAt: new Date(),
  };

  withCustomer(customerId: CustomerId): this {
    this.data = { ...this.data, customerId };
    return this;
  }

  withChannel(channel: OrderBuild["channel"]): this {
    this.data = { ...this.data, channel };
    return this;
  }

  withPriority(priority: OrderBuild["priority"]): this {
    this.data = { ...this.data, priority };
    return this;
  }

  withMode(mode: OrderBuild["mode"]): this {
    this.data = { ...this.data, mode };
    return this;
  }

  build(): OrderBuild {
    return this.data;
  }
}

export function anOrder(): OrderBuilder {
  return new OrderBuilder();
}

// --- WorkItem --------------------------------------------------------------

export interface WorkItemBuild {
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

export class WorkItemBuilder {
  private data: WorkItemBuild = {
    id: asWorkItemId(nextId("workitem")),
    orderId: asOrderId(nextId("order")),
    productTypeId: null,
    departmentId: null,
    state: "NEW",
    requiresDesign: true,
    requiresReview: true,
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  withOrder(orderId: OrderId): this {
    this.data = { ...this.data, orderId };
    return this;
  }

  withState(state: WorkItemState): this {
    this.data = { ...this.data, state };
    return this;
  }

  withAssignee(assigneeId: UserId): this {
    this.data = { ...this.data, assigneeId };
    return this;
  }

  withDepartment(departmentId: string): this {
    this.data = { ...this.data, departmentId };
    return this;
  }

  requiresDesign(value: boolean): this {
    this.data = { ...this.data, requiresDesign: value };
    return this;
  }

  requiresReview(value: boolean): this {
    this.data = { ...this.data, requiresReview: value };
    return this;
  }

  build(): WorkItemBuild {
    return this.data;
  }
}

export function aWorkItem(): WorkItemBuilder {
  return new WorkItemBuilder();
}
