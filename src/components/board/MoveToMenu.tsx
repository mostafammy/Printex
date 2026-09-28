"use client";

/**
 * MoveToMenu: keyboard & mobile target selection for card moves (shortcut 'M').
 * (specs/017-press-floor-board/contracts/board-engine.md §Accessibility, FR-020, FR-035c, plan.md S1)
 *
 * Declares itself modal, so it now behaves modally: focus moves into the
 * dialog on open, Tab is trapped inside it, and focus returns to the ticket
 * that opened it. It previously bound only Escape, which meant a keyboard
 * user could Tab straight out of a dialog claiming to be modal.
 */

import React, { useEffect, useRef } from "react";
import type { BoardCard, MoveOption } from "~/lib/board/types";
import { useBoardController } from "./hooks/useBoardController";

export interface MoveToMenuProps {
  readonly card: BoardCard | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function OptionItem({
  option,
  onSelect,
}: {
  readonly option: MoveOption;
  readonly onSelect: (o: MoveOption) => void;
}) {
  const colorClass = option.destructive
    ? "text-destructive hover:bg-destructive/10"
    : option.backward
      ? "text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
      : "hover:bg-accent";

  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect(option)}
        className={`flex min-h-11 w-full items-center justify-between rounded-[var(--board-radius)] px-2.5 text-start text-[13px] font-semibold transition-colors ${colorClass}`}
      >
        <span>{option.labelAr}</span>
        {option.kind !== "DIRECT" && (
          <span className="text-xs text-muted-foreground">
            {option.kind === "SHEET" ? "(يتطلب تفاصيل)" : "(فتح شاشة)"}
          </span>
        )}
      </button>
    </li>
  );
}

function OptionsList({
  moves,
  onSelect,
}: {
  readonly moves: readonly MoveOption[];
  readonly onSelect: (o: MoveOption) => void;
}) {
  if (moves.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        لا توجد وجهات متاحة لهذا الطلب حالياً
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5" role="menu">
      {moves.map((o) => (
        <OptionItem key={o.edgeId} option={o} onSelect={onSelect} />
      ))}
    </ul>
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function MoveToMenu({ card, isOpen, onClose }: MoveToMenuProps) {
  const controller = useBoardController();
  const menuRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Focus the first option so the dialog opens somewhere actionable rather
    // than at the top of the document behind the overlay.
    const first = menuRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !menuRef.current) return;

      // Trap Tab inside the dialog.
      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) return;
      const firstEl = focusable[0]!;
      const lastEl = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey && (active === firstEl || !menuRef.current.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Restore focus to the ticket that opened the menu, so the keyboard user's
  // position in the lane survives opening and cancelling the move dialog.
  useEffect(() => {
    if (isOpen) return;
    const el = previouslyFocusedRef.current;
    if (el && document.contains(el)) {
      el.focus();
      previouslyFocusedRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen || !card) return null;
  const onSelect = (o: MoveOption) => {
    onClose();
    void controller.executeMove(card, o);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`نقل الطلب: ${card.title}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={menuRef}
        className="w-full max-w-sm rounded-[var(--board-radius)] border border-[var(--board-line-strong)] bg-popover p-3 text-popover-foreground"
      >
        <div className="mb-2 flex items-center justify-between border-b border-[var(--board-line-strong)] pb-1.5">
          <h3 className="text-sm font-bold">نقل إلى...</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            إغلاق (Esc)
          </button>
        </div>
        <OptionsList moves={card.moves} onSelect={onSelect} />
      </div>
    </div>
  );
}
