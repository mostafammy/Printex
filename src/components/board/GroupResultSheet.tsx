"use client";

/**
 * GroupResultSheet: presents summary of group move items (MOVED, REFUSED, NOT_ELIGIBLE).
 * (specs/017-press-floor-board/contracts/board-engine.md §React surface, FR-019, plan.md S1)
 */

import React from "react";
import type { GroupMoveItemResult, GroupMoveResult } from "~/lib/board/types";

export interface GroupResultSheetProps {
  readonly result: GroupMoveResult | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function ItemRow({ item }: { readonly item: GroupMoveItemResult }) {
  if (item.status === "MOVED") {
    return (
      <div className="flex items-center justify-between bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-800 dark:text-emerald-300">
        <span className="font-medium">{item.card.title}</span>
        <span className="bg-emerald-500/20 px-1 text-[10px] font-bold leading-4">تم النقل</span>
      </div>
    );
  }

  if (item.status === "REFUSED") {
    return (
      <div className="flex flex-col gap-0.5 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
        <div className="flex items-center justify-between">
          <span className="font-medium">طلب #{item.workItemId.slice(-4)}</span>
          <span className="bg-destructive/20 px-1 text-[10px] font-bold leading-4">تعذر النقل</span>
        </div>
        <p className="text-[11px] opacity-90">{item.messageAr}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
      <span>طلب #{item.workItemId.slice(-4)}</span>
      <span className="text-[11px]">{item.reasonAr}</span>
    </div>
  );
}

export function GroupResultSheet({ result, isOpen, onClose }: GroupResultSheetProps) {
  if (!isOpen || !result) return null;

  const movedCount = result.items.filter((i) => i.status === "MOVED").length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="نتائج نقل المجموعة"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-[var(--board-radius)] border border-[var(--board-line-strong)] bg-popover p-4 text-popover-foreground">
        <div className="mb-3 flex items-center justify-between border-b border-[var(--board-line-strong)] pb-2">
          <div>
            <h3 className="text-sm font-bold">نتيجة نقل طلبات الأمر</h3>
            <p className="text-xs text-muted-foreground">تم نقل {movedCount} من أصل {result.items.length}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-xs text-muted-foreground hover:text-foreground">
            إغلاق
          </button>
        </div>

        <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {result.items.map((item) => (
            <ItemRow key={item.workItemId} item={item} />
          ))}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[var(--board-radius)] bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            حسناً
          </button>
        </div>
      </div>
    </div>
  );
}
