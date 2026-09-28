/**
 * OrdersSource: searches orders for ⌘K through Server Action.
 * Does not import src/server/**.
 * (specs/017-press-floor-board/plan.md S1, S4, research.md R11)
 */

import { searchOrdersAction } from "~/app/(shell)/board/actions";
import type { CommandItem, CommandSource } from "../CommandBarRegistry";

export class OrdersSource implements CommandSource {
  readonly id = "orders";
  readonly labelAr = "الطلبات";

  async search(query: string): Promise<readonly CommandItem[]> {
    const q = query.trim();
    if (!q) return [];

    try {
      const results = await searchOrdersAction(q);
      return results.map((o) => ({
        id: `order-${o.id}`,
        title: `طلب #${o.orderNumber} — ${o.customerName}`,
        subtitle: `الحالة: ${o.status}`,
        href: `/orders/${o.id}`,
        category: "طلب",
        icon: "FileText",
      }));
    } catch {
      return [];
    }
  }
}
