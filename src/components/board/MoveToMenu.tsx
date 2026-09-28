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

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function optionColorClass(option: MoveOption): string {
  if (option.destructive) return "text-destructive hover:bg-destructive/10";
  if (option.backward) return "text-amber-700 hover:bg-amber-500/10 dark:text-amber-400";
  return "hover:bg-accent";
}

function OptionItem({
  option,
  onSelect,
}: {
  readonly option: MoveOption;
  readonly onSelect: (o: MoveOption) => void;
}) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect(option)}
        className={`flex min-h-11 w-full items-center justify-between rounded-[var(--board-radius)] px-2.5 text-start text-[13px] font-semibold transition-colors ${optionColorClass(option)}`}
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

/** Tab wraps inside the dialog, so focus cannot walk out of it. */
function trapTab(e: KeyboardEvent, root: HTMLElement) {
  if (e.key !== "Tab") return false;
  const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (focusable.length === 0) return false;
  const firstEl = focusable[0]!;
  const lastEl = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  if (!root.contains(active)) {
    e.preventDefault();
    firstEl.focus();
  } else if (e.shiftKey && active === firstEl) {
    e.preventDefault();
    lastEl.focus();
  } else if (!e.shiftKey && active === lastEl) {
    e.preventDefault();
    firstEl.focus();
  }
  return true;
}

function useDialogBehavior(
  isOpen: boolean,
  onClose: () => void,
): React.RefObject<HTMLDivElement | null> {
  const menuRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Focus the first option so the dialog opens somewhere actionable rather
    // than at the top of the document behind the overlay.
    menuRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (menuRef.current) trapTab(e, menuRef.current);
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

  return menuRef;
}

function MoveDialog({
  card,
  onClose,
  onSelect,
  menuRef,
}: {
  readonly card: BoardCard;
  readonly onClose: () => void;
  readonly onSelect: (o: MoveOption) => void;
  readonly menuRef: React.RefObject<HTMLDivElement | null>;
}) {
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

export function MoveToMenu({ card, isOpen, onClose }: MoveToMenuProps) {
  const controller = useBoardController();
  const menuRef = useDialogBehavior(isOpen, onClose);

  if (!isOpen || !card) return null;

  return (
    <MoveDialog
      card={card}
      onClose={onClose}
      menuRef={menuRef}
      onSelect={(o) => {
        onClose();
        void controller.executeMove(card, o);
      }}
    />
  );
}
