// Fixed code-level union types for permissions and role keys.
//
// These are the frozen, compile-time vocabularies every feature imports from
// here — same pattern as 002's WorkItemState in core.prisma (constitution VI:
// "a fixed vocabulary every feature imports, not admin-configurable data").
//
// Permission: 22 fixed keys from spec FR-010 / PRD §26 / PRD §48.
// RoleKey:    7 stable identifiers from spec FR-011 / PRD §48.
//
// Adding a new Permission key is a code change (new business logic implies a
// new code path checking it) — it is NOT an admin-configurable action.
// The role × permission assignment (which Role gets which Permission) lives
// in the database (Role / RolePermission tables) and is seeded in seed.ts.
//
// Docs: specs/001-identity-access-audit/data-model.md §"Fixed code-level union"
//       specs/001-identity-access-audit/contracts/auth.md §Actor

/**
 * All 23 permission keys supported by this application (spec FR-010, PRD §26/§48; 016 FR-013).
 *
 * Every server action's authorization call must use one of these keys:
 *   authorize(actor, "order.create")  // compile-time typo-safe
 *
 * Never compare actor.roles against a RoleKey for authorization decisions —
 * always call authorize() with a Permission key (spec FR-013, constitution V).
 */
export type Permission =
  // Order lifecycle
  | "order.create"
  | "order.edit"
  | "order.cancel"
  // Customer
  | "customer.manage"
  // Work item routing
  | "workitem.assign_designer"
  // Design
  | "design.work"
  | "design.review"
  // Order change control (016 FR-013: approve or reject change requests in production)
  | "change.approve"
  // Production
  | "production.operate"
  // Collection / delivery
  | "collection.receive"
  | "delivery.record"
  // Pricing — note: pricing.set_variable and pricing.override are NOT seeded
  // onto the ACCOUNTING role by default; they are granted per-user via
  // UserPermission when an Admin explicitly configures a specific accounting
  // user as a pricing user (spec FR-014, PRD §26).
  | "pricing.use_fixed"
  | "pricing.set_variable"
  | "pricing.override"
  // Finance / payment
  | "payment.record"
  | "payment.void"
  | "expense.record"
  | "finance.view"
  // Files
  | "files.download_production"
  // Audit log access
  | "audit.view"
  // Administration
  | "admin.users"
  | "admin.config"
  | "admin.override";

/**
 * The 7 stable role identifiers from PRD §48.
 *
 * These are used ONLY for:
 *   1. Seeding Role.key values in seed.ts
 *   2. Typing Actor.roles (informational — for display only)
 *
 * Never use RoleKey in a business-logic branch (spec FR-013):
 *   ❌  if (actor.roles.includes("ADMIN_OWNER")) { ... }
 *   ✅  authorize(actor, "admin.users")
 */
export type RoleKey =
  | "RECEPTION"
  | "DESIGNER"
  | "HEAD_DESIGNER"
  | "PRODUCTION_OPERATOR"
  | "PRINT_RECEPTION_DELIVERY"
  | "ACCOUNTING"
  | "ADMIN_OWNER";

/**
 * All 23 Permission keys as a runtime array, matching the type above exactly.
 * Used by seed.ts and contract tests to iterate over the full permission set
 * without hardcoding the list a second time.
 *
 * If you add a key to the Permission type above, add it here too — TypeScript
 * will not catch an omission in this array (it only checks element types, not
 * exhaustiveness of the union here). The contract test SC-001 will catch it.
 */
export const ALL_PERMISSIONS: readonly Permission[] = [
  "order.create",
  "order.edit",
  "order.cancel",
  "customer.manage",
  "workitem.assign_designer",
  "design.work",
  "design.review",
  "change.approve",
  "production.operate",
  "collection.receive",
  "delivery.record",
  "pricing.use_fixed",
  "pricing.set_variable",
  "pricing.override",
  "payment.record",
  "payment.void",
  "expense.record",
  "finance.view",
  "files.download_production",
  "audit.view",
  "admin.users",
  "admin.config",
  "admin.override",
] as const;

/**
 * All 7 RoleKey values as a runtime array.
 * Used by seed.ts and contract tests to iterate over seeded roles.
 */
export const ALL_ROLE_KEYS: readonly RoleKey[] = [
  "RECEPTION",
  "DESIGNER",
  "HEAD_DESIGNER",
  "PRODUCTION_OPERATOR",
  "PRINT_RECEPTION_DELIVERY",
  "ACCOUNTING",
  "ADMIN_OWNER",
] as const;
