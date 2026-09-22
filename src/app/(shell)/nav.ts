// Shell navigation model — spec.md User Story 3, FR-013.
//
// Permission/role logic here is deliberately shell-local (not
// `src/server/core/**`): the real permission model belongs to
// `001-identity-access-audit`, which this feature only stubs the `Actor`
// shape for (see `src/server/core/actor.ts`, `src/server/auth/index.ts`).
// This is a placeholder, role-based filter good enough to demonstrate
// FR-013's "navigation filtered to what the signed-in user's permissions
// allow" acceptance scenario for the Phase 5 shell; 001 may replace the
// matching rule (e.g. permission strings instead of role names) without
// touching `src/server/core/**`.
// eslint-disable-next-line no-restricted-imports -- the src/server/core public barrel (index.ts) is not created until T038 (Phase 6); this deep import of the Actor type is the sanctioned exception until then (same pattern as src/server/auth/index.ts).
import type { Actor } from "~/server/core/actor";

import ar from "../../../messages/ar.json";

export interface NavItem {
  readonly id: string;
  readonly href: string;
  readonly label: string;
  // Roles allowed to see this entry. An empty array means "every signed-in
  // actor, regardless of role" (used for "My queue", which every print-shop
  // role has).
  readonly roles: readonly string[];
}

// Placeholder sidebar sections. Only `my-queue` (T033) is a real, reachable
// page this phase; the rest are realistic print-shop department sections
// (loosely matching PRD role names: Reception, Design, Production, Delivery,
// Admin) reserved for future features' nav entries — not yet backed by a
// page, so they intentionally have no route behind them beyond the label.
export const navItems: readonly NavItem[] = [
  { id: "my-queue", href: "/my-queue", label: ar.nav.myQueue, roles: [] },
  {
    id: "reception",
    href: "/reception",
    label: ar.nav.reception,
    roles: ["reception", "admin"],
  },
  {
    id: "design",
    href: "/design",
    label: ar.nav.design,
    roles: ["design", "admin"],
  },
  {
    id: "production",
    href: "/production",
    label: ar.nav.production,
    roles: ["production", "admin"],
  },
  {
    id: "delivery",
    href: "/delivery",
    label: ar.nav.delivery,
    roles: ["delivery", "admin"],
  },
  { id: "admin", href: "/admin", label: ar.nav.admin, roles: ["admin"] },
];

// Pure, framework-free filter: shows only the entries `actor`'s roles allow.
// Exercised directly by tests/unit/shell-nav.test.ts against a fake Actor,
// and by the shell layout (src/app/(shell)/layout.tsx) against whatever
// `getActor()` returns (or the temporary dev fallback — see that file).
export function filterNavByPermissions(
  actor: Actor,
  items: readonly NavItem[] = navItems,
): NavItem[] {
  return items.filter(
    (item) =>
      item.roles.length === 0 ||
      item.roles.some((role) => actor.roles.includes(role)),
  );
}
