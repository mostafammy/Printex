"use client";

/**
 * SendBackSheet: captures reason for IN_PRODUCTION → REWORK_REQUIRED (production send-back).
 * Apple-grade dialog with clean inputs, validation counters, and smooth feedback.
 * (FR-015, research.md R3, plan.md S1)
 */

import React, { useState } from "react";
import { RotateCcw, ArrowLeft, X, AlertTriangle } from "lucide-react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

export interface SendBackSheetProps {
  readonly request: SheetRequest;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function SendBackHeader({ card, onCancel }: { readonly card: SheetRequest["card"]; readonly onCancel: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25">
          <RotateCcw className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-2xs font-bold">
            <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">الإنتاج</span>
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
            <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-amber-700 dark:text-amber-300">
              إعادة للتصميم
            </span>
          </div>
          <h2 className="text-base font-bold text-foreground line-clamp-1">إعادة الطلب للتصميم والتعديل</h2>
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

function SendBackReasonField({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-foreground flex items-center gap-1" htmlFor="send-back-reason">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span>سبب الإعادة للتصميم</span>
          <span className="text-rose-500">*</span>
        </label>
        <span className="text-2xs text-muted-foreground">{value.trim().length} / 5 أحرف كحد أدنى</span>
      </div>
      <textarea
        id="send-back-reason"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={5}
        rows={3}
        placeholder="اشرح المشكلة الفنية أو سبب إعادة الطلب من المطبعة للتصميم..."
        className="w-full rounded-xl border border-border/80 bg-background/90 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-2xs resize-none"
      />
    </div>
  );
}

function SendBackActions({ canSubmit, onCancel }: { readonly canSubmit: boolean; readonly onCancel: () => void }) {
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
        disabled={!canSubmit}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 disabled:opacity-40 disabled:pointer-events-none"
      >
        <RotateCcw className="h-4 w-4" />
        <span>تأكيد الإعادة</span>
      </button>
    </div>
  );
}

export function SendBackSheet({ request, onConfirm, onCancel }: SendBackSheetProps) {
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= 5;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) onConfirm({ reason: reason.trim() });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4.5" dir="rtl">
      <SendBackHeader card={request.card} onCancel={onCancel} />
      <SendBackReasonField value={reason} onChange={setReason} />
      <SendBackActions canSubmit={canSubmit} onCancel={onCancel} />
    </form>
  );
}
