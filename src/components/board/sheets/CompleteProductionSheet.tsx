"use client";

/**
 * CompleteProductionSheet: captures produced quantity for IN_PRODUCTION → PRODUCTION_COMPLETED.
 * Apple-grade dialog with quantity steppers, target reference, and clean confirmation.
 * (FR-015, research.md R3, plan.md S1)
 */

import React, { useState } from "react";
import { CheckCircle2, ArrowLeft, X, PackageCheck, Plus, Minus } from "lucide-react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

export interface CompleteProductionSheetProps {
  readonly request: SheetRequest;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function CompleteProductionHeader({
  card,
  onCancel,
}: {
  readonly card: SheetRequest["card"];
  readonly onCancel: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25">
          <PackageCheck className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-2xs font-bold">
            <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">الإنتاج</span>
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
            <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
              جاهز للتسليم
            </span>
          </div>
          <h2 className="text-base font-bold text-foreground line-clamp-1">إتمام الطباعة والإنتاج</h2>
          <p className="text-xs text-muted-foreground line-clamp-1">
            <span className="font-mono font-bold text-foreground">#{card.orderNumber}</span> — {card.title}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
        aria-label="إلغاء وإغلاق"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StepperControls({
  quantity,
  onChange,
}: {
  readonly quantity: number;
  readonly onChange: (updater: (q: number) => number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <button
        type="button"
        onClick={() => onChange((q) => Math.max(1, q - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground hover:bg-muted active:scale-95 transition-all shadow-2xs"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        id="produced-qty"
        type="number"
        min={1}
        value={quantity}
        onChange={(e) => onChange(() => Math.max(1, Number(e.target.value) || 1))}
        required
        className="w-32 rounded-xl border border-border/80 bg-background text-center py-2 text-base font-bold font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-2xs"
      />
      <button
        type="button"
        onClick={() => onChange((q) => q + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground hover:bg-muted active:scale-95 transition-all shadow-2xs"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function QuantityStepperField({
  quantity,
  targetQuantity,
  onChange,
}: {
  readonly quantity: number;
  readonly targetQuantity: number;
  readonly onChange: (updater: (q: number) => number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/60 p-4">
      <label className="text-xs font-bold text-foreground flex items-center justify-between" htmlFor="produced-qty">
        <span>الكمية المكتملة فعلياً</span>
        <span className="text-2xs text-muted-foreground">المطلوب في أمر الشغل: {targetQuantity} نسخة</span>
      </label>
      <StepperControls quantity={quantity} onChange={onChange} />
      {quantity !== targetQuantity && (
        <p className="text-center text-2xs font-semibold text-amber-600 dark:text-amber-400">
          تنبيه: الكمية المنتجة تختلف عن الكمية المطلوبة ({targetQuantity})
        </p>
      )}
    </div>
  );
}

function CompleteActions({ disabled, onCancel }: { readonly disabled: boolean; readonly onCancel: () => void }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-border/70 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="w-full sm:w-auto rounded-xl border border-border/80 bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-98 shadow-2xs"
      >
        إلغاء (Esc)
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 disabled:opacity-40 disabled:pointer-events-none"
      >
        <CheckCircle2 className="h-4 w-4" />
        <span>تأكيد إتمام الإنتاج</span>
      </button>
    </div>
  );
}

export function CompleteProductionSheet({
  request,
  onConfirm,
  onCancel,
}: CompleteProductionSheetProps) {
  const targetQuantity = request.card.quantity ?? 1;
  const [quantity, setQuantity] = useState(targetQuantity);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity >= 1) onConfirm({ producedQuantity: quantity });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4.5" dir="rtl">
      <CompleteProductionHeader card={request.card} onCancel={onCancel} />
      <QuantityStepperField quantity={quantity} targetQuantity={targetQuantity} onChange={setQuantity} />
      <CompleteActions disabled={quantity < 1} onCancel={onCancel} />
    </form>
  );
}
