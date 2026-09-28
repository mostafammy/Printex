/**
 * Arabic screen-reader announcements dictionary for @dnd-kit/core.
 * (research.md R7, FR-032, plan.md S1)
 */

import type { Announcements } from "@dnd-kit/core";

export const ARABIC_DND_ANNOUNCEMENTS: Announcements = {
  onDragStart({ active }) {
    return `تم رفع بطاقة أمر العمل رقم ${active.id}`;
  },
  onDragOver({ over }) {
    if (!over) return "البطاقة خارج المحطات المتاحة";
    return `البطاقة فوق محطة ${over.id}`;
  },
  onDragEnd({ over }) {
    if (!over) return "تم إلغاء النقل وعادت البطاقة لموقعها";
    return `تم إفلات البطاقة في محطة ${over.id}`;
  },
  onDragCancel() {
    return "تم إلغاء سحب البطاقة وعادت لموقعها الأصلي";
  },
};
