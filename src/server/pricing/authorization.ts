import { authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import type { Permission } from "~/server/auth";

export type PricingOperation = "APPLY_QUOTE" | "VARIABLE" | "OVERRIDE" | "CONFIGURE";

const operationPermissions: Record<PricingOperation, Permission> = {
  APPLY_QUOTE: "pricing.use_fixed",
  VARIABLE: "pricing.set_variable",
  OVERRIDE: "pricing.override",
  CONFIGURE: "admin.config",
};

export function authorizePricingOperation(actor: Actor, operation: PricingOperation): void {
  authorize(actor, operationPermissions[operation]);
}

export function pricingPermissionFor(operation: PricingOperation): Permission {
  return operationPermissions[operation];
}