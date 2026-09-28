"use client";

/**
 * MoveToMenu: keyboard & mobile target selection for card moves (shortcut 'M').
 * (specs/017-press-floor-board/contracts/board-engine.md §Accessibility, FR-020, FR-035c, plan.md S1)
 */

import React, { useEffect, useRef } from "react";
import type { BoardCard, MoveOption } from "~/lib/board/types";
import { useBoardController } from "./hooks/useBoardController";

export interface MoveToMenuProps {
  readonly card: BoardCard | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function OptionItem({ option, onSelect }: { readonly option: MoveOption; readonly onSelect: (o: MoveOption) => void }) {
  const colorClass = option.destructive
    ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
    : option.backward
      ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
      : "hover:bg-accent";

  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect(option)}
        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-start text-xs font-medium transition-colors ${colorClass}`}
      >
        <span>{option.labelAr}</span>
        {option.kind !== "DIRECT" && (
          <span className="text-[10px] text-muted-foreground">
            {option.kind === "SHEET" ? "(يتطلب تفاصيل)" : "(فتح شاشة)"}
          </span>
        )}
      </button>
    </li>
  );
}

function OptionsList({ moves, onSelect }: { readonly moves: readonly MoveOption[]; readonly onSelect: (o: MoveOption) => void }) {
  if (moves.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">لا توجد وجهات متاحة لهذا الطلب حالياً</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5" role="menu">
      {moves.map((o) => (
        <OptionItem key={o.edgeId} option={o} onSelect={onSelect} />
      ))}
    </ul>
  );
}

export function MoveToMenu({ card, isOpen, onClose }: MoveToMenuProps) {
  const controller = useBoardController();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !card) return null;
  const onSelect = (o: MoveOption) => { onClose(); void controller.executeMove(card, o); };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`نقل الطلب: ${card.title}`}
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={menuRef} className="w-full max-w-sm rounded-xl border bg-white p-4 shadow-xl dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between border-b pb-2">
          <h3 className="text-sm font-semibold">نقل إلى...</h3>
          <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            إغلاق (Esc)
          </button>
        </div>
        <OptionsList moves={card.moves} onSelect={onSelect} />
      </div>
    </div>
  );
}
