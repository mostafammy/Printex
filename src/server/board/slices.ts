/**
 * Role slices resolution, default slice mapping, and multi-role precedence.
 * (specs/017-press-floor-board/spec.md FR-021, data-model.md §3.7, plan.md S1)
 */

import type { RoleKey } from "~/server/auth/permissions";
import { SLICES, type SliceDefinition, type SliceId } from "~/lib/board/slices";

export { SLICES };
export type { SliceDefinition, SliceId };

export const ROLE_DEFAULT_SLICE: Readonly<Record<RoleKey, SliceId>> = {
  ADMIN_OWNER: "floor",
  HEAD_DESIGNER: "head-designer",
  ACCOUNTING: "accounting",
  RECEPTION: "reception",
  PRINT_RECEPTION_DELIVERY: "delivery",
  PRODUCTION_OPERATOR: "production",
  DESIGNER: "designer",
};

/**
 * Multi-role precedence order per FR-021:
 * Admin > Head Designer > Accounting > Reception > Delivery staff > Production operator > Designer
 */
export const ROLE_PRECEDENCE: readonly RoleKey[] = [
  "ADMIN_OWNER",
  "HEAD_DESIGNER",
  "ACCOUNTING",
  "RECEPTION",
  "PRINT_RECEPTION_DELIVERY",
  "PRODUCTION_OPERATOR",
  "DESIGNER",
] as const;

export function resolveDefaultSlice(roles: readonly RoleKey[]): SliceId {
  for (const roleKey of ROLE_PRECEDENCE) {
    if (roles.includes(roleKey)) {
      return ROLE_DEFAULT_SLICE[roleKey];
    }
  }
  return "floor";
}

export function resolveAvailableSlices(roles: readonly RoleKey[]): SliceId[] {
  if (roles.includes("ADMIN_OWNER")) {
    return SLICES.map((s) => s.id);
  }

  const slices = new Set<SliceId>();
  for (const r of roles) {
    const slice = ROLE_DEFAULT_SLICE[r];
    if (slice) {
      slices.add(slice);
    }
  }

  if (slices.size === 0) {
    slices.add("floor");
  }

  // Preserve order matching SLICES definition
  return SLICES.map((s) => s.id).filter((id) => slices.has(id));
}
