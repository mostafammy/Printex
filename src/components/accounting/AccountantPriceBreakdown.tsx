"use client";

/**
 * The 093 quote breakdown shown on the accountant's order list.
 *
 * Split out of AccountantOrdersView.tsx because it is a self-contained concern
 * and keeping it inline pushed that file past its line budget.
 *
 * It exists because "approve the total" and "change the total" are only
 * meaningful decisions if the derivation is on screen. A single number gives the
 * accountant nothing to check the customer's quote against and nothing to argue
 * with when it looks wrong — and this figure is exactly what the customer was
 * quoted, so it is the figure most worth scrutinising.
 *
 * Rows render only where a value exists. A non-roll item has no area, no rate
 * and no rounded width; showing those as zero would read as "this job was
 * free" rather than "there is nothing to approve".
 */

import React from "react";
import type { AccountantOrderItem } from "~/server/accounting";

export interface AccountantPriceBreakdownProps {
  readonly item: AccountantOrderItem;
}

const money = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface CellSpec {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}

function cells(item: AccountantOrderItem): readonly CellSpec[] {
  const out: CellSpec[] = [];

  if (item.customerWidthCm !== null) {
    out.push({ label: "عرض العميل", value: `${item.customerWidthCm} سم` });
  }
  if (item.productionWidthCm !== null) {
    const roundedUp =
      item.customerWidthCm !== null && item.productionWidthCm !== item.customerWidthCm;
    out.push({
      label: roundedUp ? "عرض الإنتاج (مقرّب لأعلى)" : "عرض الإنتاج",
      value: `${item.productionWidthCm} سم`,
      hint: roundedUp ? `مقرب لأعلى من ${item.customerWidthCm} سم` : undefined,
    });
  }
  if (item.productionHeightM !== null) {
    out.push({ label: "الارتفاع", value: `${item.productionHeightM} م` });
  }
  if (item.productionAreaSqm !== null) {
    out.push({ label: "المساحة", value: `${item.productionAreaSqm} م²` });
  }
  if (item.baseRatePerSqm !== null) {
    out.push({ label: "سعر المتر المربع", value: `${money(item.baseRatePerSqm)} ج.م` });
  }
  if (item.quantity > 1) {
    out.push({ label: "الكمية", value: `${item.quantity}` });
  }

  return out;
}

function Cell({ label, value, hint }: CellSpec) {
  return (
    <div className="flex flex-col">
      <span className="text-2xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-bold text-foreground">{value}</span>
      {hint && <span className="text-2xs text-muted-foreground/80">{hint}</span>}
    </div>
  );
}

function FinishingLines({ item }: { readonly item: AccountantOrderItem }) {
  if (item.finishingLines.length === 0) return null;
  return (
    <div className="mt-3 border-t border-border/50 pt-2.5">
      <p className="mb-1.5 text-2xs font-bold text-muted-foreground">خدمات إضافية</p>
      <div className="flex flex-col gap-1">
        {item.finishingLines.map((line) => (
          <div
            key={`${item.id}-${line.labelAr}`}
            className="flex items-center justify-between gap-3 text-2xs"
          >
            <span className="text-foreground">
              {line.labelAr}{" "}
              <span className="text-muted-foreground">({money(line.ratePerSqm)} ج.م/م²)</span>
            </span>
            <span className="font-mono font-bold text-foreground">
              {money(line.totalAmount)} ج.م
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Totals({ item }: { readonly item: AccountantOrderItem }) {
  return (
    <div className="mt-3 flex flex-col gap-1 border-t border-border/50 pt-2.5 text-2xs">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">إجمالي الأساس</span>
        <span className="font-mono font-bold text-foreground">{money(item.baseTotal)} ج.م</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">إجمالي الخدمات الإضافية</span>
        <span
          className={`font-mono font-bold ${
            item.finishingTotal === null ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {money(item.finishingTotal)} ج.م
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/40 pt-1.5">
        <span className="font-extrabold text-foreground">الإجمالي المطلوب اعتماده</span>
        <span className="font-mono text-sm font-black text-primary">
          {money(item.productionTotal ?? item.baseTotal)} ج.م
        </span>
      </div>
    </div>
  );
}

export function AccountantPriceBreakdown({ item }: AccountantPriceBreakdownProps) {
  return (
    <div className="mt-3 rounded-xl border border-amber-500/20 bg-background/60 p-3.5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {cells(item).map((c) => (
          <Cell key={c.label} {...c} />
        ))}
      </div>
      <FinishingLines item={item} />
      <Totals item={item} />
    </div>
  );
}