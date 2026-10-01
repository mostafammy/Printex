/**
 * PagesSource: searches accessible application pages for ⌘K.
 * (specs/017-press-floor-board/plan.md S1, research.md R11)
 */

import { navItems } from "~/app/(shell)/nav";
import type { CommandItem, CommandSource } from "../CommandBarRegistry";

export class PagesSource implements CommandSource {
  readonly id = "pages";
  readonly labelAr = "الصفحات";

  async search(query: string): Promise<readonly CommandItem[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const pages = [
      { id: "board", label: "لوحة أرضية المطبعة", href: "/board" },
      { id: "reception-new", label: "طلب جديد (إضافة طلب / صنف)", href: "/reception/new" },
      ...navItems.map((n) => ({ id: n.id, label: n.label, href: n.href })),
    ];

    return pages
      .filter((p) => p.label.toLowerCase().includes(q) || p.id.includes(q))
      .map((p) => ({
        id: `page-${p.id}`,
        title: p.label,
        subtitle: p.href,
        href: p.href,
        category: "صفحة",
        icon: "LayoutGrid",
      }));
  }
}
