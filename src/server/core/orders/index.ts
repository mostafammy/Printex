// Order status is computed at read time by `deriveOrderStatus` and MUST NOT
// be persisted as a database column (constitution I; spec FR-008).

export { deriveOrderStatus } from "./deriveOrderStatus";
export type { OrderStatusBucket } from "./deriveOrderStatus";
