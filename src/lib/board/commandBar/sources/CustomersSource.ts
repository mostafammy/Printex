/**
 * CustomersSource: searches customers for ⌘K through Server Action.
 * Does not import src/server/**.
 * (specs/017-press-floor-board/plan.md S1, S4, research.md R11)
 */

import { searchCustomersAction } from "~/app/(shell)/board/actions";
import type { CommandItem, CommandSource } from "../CommandBarRegistry";

export class CustomersSource implements CommandSource {
  readonly id = "customers";
  readonly labelAr = "العملاء";

  async search(query: string): Promise<readonly CommandItem[]> {
    const q = query.trim();
    if (!q) return [];

    try {
      const results = await searchCustomersAction(q);
      return results.map((c) => ({
        id: `customer-${c.id}`,
        title: c.name,
        subtitle: "عميل مسجل",
        href: `/customers/${c.id}`,
        category: "عميل",
        icon: "User",
      }));
    } catch {
      return [];
    }
  }
}
