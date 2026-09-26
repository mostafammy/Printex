// Barrel — the ONLY legal import surface from outside src/server/orders/**
// (specs/011-orders-reception/data-model.md "Module boundary").
// Populated incrementally as each Setup/Foundational/User Story task lands.

export { DomainOrderError } from "./errors";
export { isOrderComplete, isOrderFinished, PRE_DESIGN_EDITABLE_STATES } from "./completeness";

// US1 / US2
export { quickCreateOrder, createOrder } from "./create";
export type { QuickCreateOrderInput, CreateOrderInput, WorkItemCreateInput } from "./create";

// US2 (read helper) / Polish (admin CRUD)
export {
  listActiveProductTypes,
  createProductType,
  renameProductType,
  updateProductTypeDefaults,
  deactivateProductType,
} from "./productTypes";
export type {
  ActiveProductType,
  CreateProductTypeInput,
  UpdateProductTypeDefaultsInput,
} from "./productTypes";

// US3 / US4 / US5
export {
  listReceptionQueue,
  listReceptionQueuePage,
  getReceptionQueueStats,
  getOrderDetail,
  searchOrders,
} from "./search";
export type { OrderSearchResult, OrderQueueRow, TimelineEntry } from "./search";

// US3 (priority) / US6 (cancel)
export { changeOrderPriority, cancelWorkItem, cancelOrder, WorkItemTransitionError } from "./cancelOrder";

// US7 / US8
export { addWorkItem, editWorkItem } from "./workItems";
export type { EditWorkItemPatch } from "./workItems";
