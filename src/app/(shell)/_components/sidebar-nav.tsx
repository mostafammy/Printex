import Link from "next/link";

// eslint-disable-next-line no-restricted-imports -- the src/server/core public barrel (index.ts) is not created until T038 (Phase 6); this deep import of the Actor type is the sanctioned exception until then (same pattern as src/server/auth/index.ts).
import type { Actor } from "~/server/core/actor";

import { filterNavByPermissions, navItems } from "../nav";

export function SidebarNav({ actor }: { actor: Actor }) {
  const items = filterNavByPermissions(actor, navItems);

  return (
    <nav aria-label="التنقل الرئيسي" className="flex flex-col gap-1 ps-2 pe-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="rounded-md py-2 ps-3 pe-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
