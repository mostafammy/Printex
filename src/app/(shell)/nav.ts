// Shell navigation model — spec.md User Story 3, FR-013.
//
// Permission/role logic here is deliberately shell-local (not
// `src/server/core/**`): the real permission model belongs to
// `001-identity-access-audit` (see `src/server/core/actor.ts`,
// `src/server/auth/index.ts`). The role lists below use
// `~/server/auth`'s real `RoleKey` union (type-only import, no runtime
// dependency), matching what `src/app/(shell)/layout.tsx` actually
// populates `actor.roles` with from `getActor()`.
import type { Actor } from "~/server/core";
import type { RoleKey } from "~/server/auth";

import ar from "~/messages/ar.json";

export interface NavItem {
  readonly id: string;
  readonly href: string;
  readonly label: string;
  // Roles allowed to see this entry. An empty array means "every signed-in
  // actor, regardless of role" (used for "My queue", which every print-shop
  // role has).
  readonly roles: readonly string[];
  readonly section?: "workspace" | "operations" | "finance" | "management";
  readonly iconName?: string;
}

// Real RoleKey values (~/server/auth), not the pre-001 placeholder strings
// this file used to use. `NavItem.roles` stays `readonly string[]` (not
// `readonly RoleKey[]`) so it remains structurally compatible with
// `~/server/core`'s `Actor.roles: readonly string[]` — core must not import
// from `~/server/auth` (module boundary rule), so it can't reference
// `RoleKey` directly; this file bridges the gap by importing the type only
// for compile-time literal-string safety here, not to change the field type.
const ADMIN: RoleKey = "ADMIN_OWNER";

// Sidebar sections. Only `my-queue` (T033) is a real, reachable
// page this phase; the rest are realistic print-shop department sections
// (loosely matching PRD role names: Reception, Design, Production, Delivery,
// Admin) reserved for future features' nav entries — not yet backed by a
// page, so they intentionally have no route behind them beyond the label.
export const navItems: readonly NavItem[] = [
  {
    id: "my-queue",
    href: "/my-queue",
    label: ar.nav.myQueue,
    roles: [],
    section: "workspace",
    iconName: "Clock",
  },
  {
    id: "review",
    href: "/review",
    label: ar.nav.review,
    roles: ["HEAD_DESIGNER", ADMIN],
    section: "workspace",
    iconName: "CheckCircle2",
  },
  {
    id: "reception",
    href: "/reception",
    label: ar.nav.reception,
    roles: ["RECEPTION", ADMIN],
    section: "operations",
    iconName: "Inbox",
  },
  {
    id: "design",
    href: "/design",
    label: ar.nav.design,
    roles: ["DESIGNER", "HEAD_DESIGNER", ADMIN],
    section: "operations",
    iconName: "Palette",
  },
  {
    id: "production",
    href: "/production",
    label: ar.nav.production,
    roles: ["PRODUCTION_OPERATOR", ADMIN],
    section: "operations",
    iconName: "Printer",
  },
  {
    id: "pricing",
    href: "/pricing",
    label: ar.nav.pricing,
    roles: ["RECEPTION", "ACCOUNTING", ADMIN],
    section: "operations",
    iconName: "Tag",
  },
  {
    id: "delivery",
    href: "/delivery",
    label: ar.nav.delivery,
    roles: ["PRINT_RECEPTION_DELIVERY", ADMIN],
    section: "operations",
    iconName: "Truck",
  },
  {
    id: "finance-expenses",
    href: "/finance/expenses",
    label: ar.nav.financeExpenses,
    roles: ["ACCOUNTING", ADMIN],
    section: "finance",
    iconName: "Receipt",
  },
  {
    id: "finance-daily-cash",
    href: "/finance/daily-cash",
    label: ar.nav.financeDailyCash,
    roles: ["ACCOUNTING", ADMIN],
    section: "finance",
    iconName: "Coins",
  },
  {
    id: "admin",
    // No `/admin` index page exists yet — points straight at the one admin
    // hub page that's actually built, rather than a dead link.
    href: "/admin/health",
    label: ar.nav.admin,
    roles: [ADMIN],
    section: "management",
    iconName: "ShieldAlert",
  },
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
