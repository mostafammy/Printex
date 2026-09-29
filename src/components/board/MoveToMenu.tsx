"use client";

/**
 * MoveToMenu: keyboard & mobile target selection for card moves (shortcut 'M').
 * Apple-grade quick action popover with category badges, keyboard number shortcuts (1-9),
 * contextual icons, and smooth interactive hover effects.
 * (specs/017-press-floor-board/contracts/board-engine.md §Accessibility, FR-020, FR-035c, plan.md S1)
 */

import React, { useEffect, useRef } from "react";
import {
  Palette,
  Printer,
  RotateCcw,
  CheckCheck,
  XCircle,
  Building,
  ArrowRight,
  Sparkles,
  Layers,
  CornerDownLeft,
  X,
} from "lucide-react";
import type { BoardCard, MoveOption } from "~/lib/board/types";
import { useBoardController } from "./hooks/useBoardController";

export interface MoveToMenuProps {
  readonly card: BoardCard | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function getOptionIcon(option: MoveOption) {
  if (option.edgeId.includes("ASSIGNED") || option.edgeId.includes("DESIGN")) {
    return Palette;
  }
  if (option.edgeId.includes("PRODUCTION")) {
    return Printer;
  }
  if (option.edgeId.includes("REWORK") || option.backward) {
    return RotateCcw;
  }
  if (option.edgeId.includes("COMPLETE") || option.edgeId.includes("APPROVED")) {
    return CheckCheck;
  }
  if (option.destructive || option.edgeId.includes("CANCEL")) {
    return XCircle;
  }
  return ArrowRight;
}

function optionColorClass(option: MoveOption): {
  btnCls: string;
  iconBg: string;
  badgeCls: string;
} {
  if (option.destructive) {
    return {
      btnCls: "border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-destructive hover:border-destructive/60",
      iconBg: "bg-destructive/15 text-destructive",
      badgeCls: "bg-destructive/10 text-destructive border-destructive/20",
    };
  }
  if (option.edgeId.includes("ASSIGNED") || option.edgeId.includes("DESIGN")) {
    return {
      btnCls: "border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:border-purple-500/60",
      iconBg: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
      badgeCls: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    };
  }
  if (option.backward) {
    return {
      btnCls: "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:border-amber-500/60",
      iconBg: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
      badgeCls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    };
  }
  return {
    btnCls: "border-border/70 bg-card/70 hover:bg-primary/8 text-foreground hover:border-primary/40 hover:text-primary",
    iconBg: "bg-primary/10 text-primary",
    badgeCls: "bg-muted text-muted-foreground border-border/60",
  };
}

function OptionItem({
  option,
  index,
  onSelect,
}: {
  readonly option: MoveOption;
  readonly index: number;
  readonly onSelect: (o: MoveOption) => void;
}) {
  const IconComponent = getOptionIcon(option);
  const { btnCls, iconBg, badgeCls } = optionColorClass(option);
  const shortcutNum = index < 9 ? index + 1 : null;

  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect(option)}
        className={`group flex min-h-12 w-full items-center justify-between rounded-2xl border p-3 text-start transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xs hover:shadow-xs active:scale-[0.99] ${btnCls}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${iconBg}`}
          >
            <IconComponent className="h-4 w-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold leading-tight truncate">
              {option.labelAr}
            </span>
            <span className="text-2xs text-muted-foreground">
              {option.kind === "SHEET"
                ? "يتطلب اختيار وتفاصيل"
                : option.kind === "PAGE"
                  ? "فتح صفحة المحطة"
                  : "انتقال مباشر فوري"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {shortcutNum && (
            <kbd className="hidden sm:inline-flex h-5 w-5 items-center justify-center rounded-md border border-border/80 bg-muted/60 font-mono text-2xs font-semibold text-muted-foreground shadow-2xs group-hover:border-primary/40 group-hover:text-primary">
              {shortcutNum}
            </kbd>
          )}
          <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform group-hover:-translate-x-0.5 group-hover:text-primary" />
        </div>
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
      <div className="py-8 text-center">
        <p className="text-xs font-semibold text-muted-foreground">
          لا توجد وجهات متاحة لهذا الطلب في حالته الحالية
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2" role="menu">
      {moves.map((o, idx) => (
        <OptionItem key={o.edgeId} option={o} index={idx} onSelect={onSelect} />
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
    lastEl.focus();
  }
  return true;
}

function useDialogBehavior(
  isOpen: boolean,
  card: BoardCard | null,
  onClose: () => void,
  onSelect: (o: MoveOption) => void,
): React.RefObject<HTMLDivElement | null> {
  const menuRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Focus the first option
    menuRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Check number shortcuts 1-9
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && card && card.moves[num - 1]) {
        e.preventDefault();
        onSelect(card.moves[num - 1]!);
        return;
      }

      if (menuRef.current) trapTab(e, menuRef.current);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, card, onClose, onSelect]);

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
      dir="rtl"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-md p-4 sm:items-center animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={menuRef}
        className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl p-5 text-card-foreground shadow-2xl shadow-black/30 animate-in zoom-in-95 duration-200 overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-foreground">توجيه ونقل الطلب</h3>
              <p className="text-2xs text-muted-foreground font-mono">
                #{card.orderNumber} — {card.customerName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all"
            aria-label="إغلاق (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Options List */}
        <OptionsList moves={card.moves} onSelect={onSelect} />
      </div>
    </div>
  );
}

export function MoveToMenu({ card, isOpen, onClose }: MoveToMenuProps) {
  const controller = useBoardController();
  const handleSelect = (o: MoveOption) => {
    onClose();
    if (card) {
      void controller.executeMove(card, o);
    }
  };

  const menuRef = useDialogBehavior(isOpen, card, onClose, handleSelect);

  if (!isOpen || !card) return null;

  return (
    <MoveDialog
      card={card}
      onClose={onClose}
      menuRef={menuRef}
      onSelect={handleSelect}
    />
  );
}
