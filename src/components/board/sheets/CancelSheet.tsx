"use client";

/**
 * CancelSheet: captures cancellation reason for *any* → CANCELLED.
 * Apple-grade cancellation sheet with destructive styling, validation, and safety warnings.
 * (FR-015, research.md R3, plan.md S1)
 */

import React, { useState } from "react";
import { XCircle, ArrowLeft, X, AlertOctagon } from "lucide-react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

export interface CancelSheetProps {
  readonly request: SheetRequest;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

export function CancelSheet({ request, onConfirm, onCancel }: CancelSheetProps) {
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= 5;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) onConfirm({ reason: reason.trim() });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4.5" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3.5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 to-red-600 text-white shadow-md shadow-rose-500/25">
            <XCircle className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 text-destructive px-2 py-0.5 text-2xs font-bold w-fit">
              إلغاء نهائي
            </span>
            <h2 className="text-base font-bold text-destructive line-clamp-1">
              إلغاء طلب الشغل
            </h2>
            <p className="text-xs text-muted-foreground line-clamp-1">
              <span className="font-mono font-bold text-foreground">#{request.card.orderNumber}</span> — {request.card.title}
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

      {/* Warning Notice */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/5 p-3.5 text-xs text-destructive">
        <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <span className="font-bold">إجراء غير قابل للتراجع</span>
          <span className="text-2xs text-destructive/80 leading-relaxed">
            سيتم إيقاف كافة العمليات على هذا الطلب وأرشفته كطلب ملغي.
          </span>
        </div>
      </div>

      {/* Reason Field */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-1" htmlFor="cancel-reason">
            <span>سبب الإلغاء</span>
            <span className="text-rose-500">*</span>
          </label>
          <span className="text-2xs text-muted-foreground">{reason.trim().length} / 5 أحرف كحد أدنى</span>
        </div>
        <textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={5}
          rows={3}
          placeholder="يرجى كتابة سبب الإلغاء بالتفصيل للتوثيق المالي والإداري..."
          className="w-full rounded-xl border border-border/80 bg-background/90 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive transition-all shadow-2xs resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-border/70 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto rounded-xl border border-border/80 bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-98 shadow-2xs"
        >
          الرجوع (Esc)
        </button>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-5 py-2.5 text-xs font-bold text-destructive-foreground shadow-md shadow-destructive/25 transition-all duration-200 hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 disabled:opacity-40 disabled:pointer-events-none"
        >
          <XCircle className="h-4 w-4" />
          <span>تأكيد الإلغاء النهائي</span>
        </button>
      </div>
    </form>
  );
}
