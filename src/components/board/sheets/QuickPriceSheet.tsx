"use client";

/**
 * QuickPriceSheet: price-and-release in one gesture. Shows the item's
 * details for fast calculation, a one-click apply for the live auto-quote,
 * and a manual amount+reason fallback.
 * (specs/017-press-floor-board)
 */

import React, { useEffect, useState } from "react";
import { Calculator, X, ExternalLink, BadgeCheck } from "lucide-react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";
import { STATE_AR_LABELS } from "~/lib/board/stations";
import type { QuickPriceContext } from "~/app/(shell)/board/actions";

export interface QuickPriceSheetProps {
  readonly request: SheetRequest;
  readonly fetchContext: (workItemId: string) => Promise<QuickPriceContext>;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function ItemDetails({ request }: { readonly request: SheetRequest }) {
  const card = request.card;
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["أمر الشغل", `#${card.orderNumber}`],
    ["العميل", card.customerName],
    ["الصنف", card.title],
    ["الكمية", `${card.quantity}`],
    ["المرحلة", STATE_AR_LABELS[card.state] ?? card.state],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-muted/50 p-3.5 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-bold text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function QuoteApply({ amount, unitAr, onApply }: { readonly amount: string; readonly unitAr: string | null; readonly onApply: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-2xs text-muted-foreground">السعر المحسوب تلقائياً</span>
        <span className="font-mono text-lg font-extrabold text-foreground">{Number(amount).toLocaleString("ar-EG")} ج.م</span>
        {unitAr && <span className="text-2xs text-muted-foreground">{unitAr}</span>}
      </div>
      <button
        type="button"
        onClick={onApply}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-500 active:scale-95"
      >
        <BadgeCheck className="h-4 w-4" />
        <span>اعتماد السعر والنقل</span>
      </button>
    </div>
  );
}

function ManualInputs({ amount, reason, onAmountChange, onReasonChange }: { readonly amount: string; readonly reason: string; readonly onAmountChange: (v: string) => void; readonly onReasonChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 text-2xs text-muted-foreground">
        المبلغ (ج.م)
        <input value={amount} onChange={(e) => onAmountChange(e.target.value)} inputMode="decimal" placeholder="0" className="rounded-xl border border-border/80 bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </label>
      <label className="flex flex-col gap-1 text-2xs text-muted-foreground">
        السبب
        <input value={reason} onChange={(e) => onReasonChange(e.target.value)} placeholder="سبب السعر اليدوي" className="rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </label>
    </div>
  );
}

function ManualForm({ policyMode, onSubmit }: { readonly policyMode: "FIXED" | "VARIABLE" | null; readonly onSubmit: (input: { kind: "VARIABLE" | "OVERRIDE"; amount: string; reason: string }) => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const canSubmit = amount.trim().length > 0 && reason.trim().length >= 3;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit({ kind: policyMode === "VARIABLE" ? "VARIABLE" : "OVERRIDE", amount: amount.trim(), reason: reason.trim() });
      }}
      className="flex flex-col gap-3 rounded-2xl border border-border/70 p-3.5"
    >
      <span className="text-xs font-bold text-foreground">تسعير يدوي</span>
      <ManualInputs amount={amount} reason={reason} onAmountChange={setAmount} onReasonChange={setReason} />
      <button type="submit" disabled={!canSubmit} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40">
        اعتماد يدوي والنقل للإنتاج
      </button>
    </form>
  );
}

function QuickPriceHeader({ title, currentAmount, onCancel }: { readonly title: string; readonly currentAmount?: string | null; readonly onCancel: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold text-foreground">تسعير سريع — {title}</h2>
          {currentAmount && (
            <p className="text-xs text-muted-foreground">
              السعر الحالي: <span className="font-mono font-bold text-foreground">{Number(currentAmount).toLocaleString("ar-EG")} ج.م</span>
            </p>
          )}
        </div>
      </div>
      <button type="button" onClick={onCancel} aria-label="إغلاق" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function QuickPriceFooter({ cardId, onCancel }: { readonly cardId: string; readonly onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between border-t border-border/70 pt-3">
      <a href={`/pricing?workItem=${cardId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
        <ExternalLink className="h-3.5 w-3.5" />
        <span>التسعير الكامل</span>
      </a>
      <button type="button" onClick={onCancel} className="rounded-xl border border-border/80 px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        الرجوع (Esc)
      </button>
    </div>
  );
}

export function QuickPriceSheet({ request, fetchContext, onConfirm, onCancel }: QuickPriceSheetProps) {
  const [ctx, setCtx] = useState<QuickPriceContext | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchContext(request.card.id).then((c) => { if (mounted) setCtx(c); }).catch(() => { if (mounted) setCtx(null); });
    return () => { mounted = false; };
  }, [request.card.id, fetchContext]);

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <QuickPriceHeader title={request.card.title} currentAmount={ctx?.currentAmount} onCancel={onCancel} />
      <ItemDetails request={request} />
      {ctx === null ? (
        <p className="py-2 text-center text-xs text-muted-foreground">جاري حساب السعر...</p>
      ) : (
        <>
          {ctx.quoteAmount && (
            <QuoteApply amount={ctx.quoteAmount} unitAr={ctx.quoteUnitAr} onApply={() => onConfirm({ kind: "APPLY_QUOTE" })} />
          )}
          <ManualForm policyMode={ctx.policyMode} onSubmit={(input) => onConfirm(input)} />
        </>
      )}
      <QuickPriceFooter cardId={request.card.id} onCancel={onCancel} />
    </div>
  );
}
