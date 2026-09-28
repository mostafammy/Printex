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
      <div className="flex items-center justify-between rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
        <span className="font-medium">{item.card.title}</span>
        <span className="rounded bg-emerald-200/60 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-emerald-800/60">تم النقل</span>
      </div>
    );
  }

  if (item.status === "REFUSED") {
    return (
      <div className="flex flex-col gap-1 rounded bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-200">
        <div className="flex items-center justify-between">
          <span className="font-medium">طلب #{item.workItemId.slice(-4)}</span>
          <span className="rounded bg-red-200/60 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-red-800/60">تعذر النقل</span>
        </div>
        <p className="text-[11px] text-red-600 dark:text-red-300">{item.messageAr}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
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
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-sm font-semibold">نتيجة نقل طلبات الأمر</h3>
            <p className="text-xs text-muted-foreground">تم نقل {movedCount} من أصل {result.items.length}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800">
            إغلاق
          </button>
        </div>

        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {result.items.map((item) => (
            <ItemRow key={item.workItemId} item={item} />
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            حسناً
          </button>
        </div>
      </div>
    </div>
  );
}
