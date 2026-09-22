// Branded (nominal) ID types — plan.md §5.2, §5.3.
//
// Prisma's generated PKs are plain `string`. Branding them here means the
// compiler rejects passing a CustomerId where an OrderId is expected, at the
// call site, instead of failing at runtime against Postgres.

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type CustomerId = Brand<string, "CustomerId">;
export type OrderId = Brand<string, "OrderId">;
export type WorkItemId = Brand<string, "WorkItemId">;
export type UserId = Brand<string, "UserId">;

// One sanctioned way to create each branded ID from a Prisma-returned plain
// string — callers must go through these, never a raw `as` cast elsewhere.

export function asCustomerId(id: string): CustomerId {
  return id as CustomerId;
}

export function asOrderId(id: string): OrderId {
  return id as OrderId;
}

export function asWorkItemId(id: string): WorkItemId {
  return id as WorkItemId;
}

export function asUserId(id: string): UserId {
  return id as UserId;
}
