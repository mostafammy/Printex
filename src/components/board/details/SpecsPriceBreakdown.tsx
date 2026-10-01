"use client";

/**
 * The 093 quote breakdown inside the board popup's Specs tab.
 *
 * Split out of SpecsCards.tsx because it is a self-contained concern with its
 * own size, and keeping it inline pushed that file past its line budget.
 *
 * It exists because `currentPrice` is one number with no visible derivation, so
 * it gives an accountant nothing to check against the customer's quote and
 * nothing to argue with when it looks wrong. Rows are rendered only where a
 * value exists: an absent figure shown as "0.00" reads as "this job was free"
 * rather than "there is nothing here", which is the opposite of the truth for a
 * non-roll item that was never area-priced.
 */

import React from "react";
import { Sparkles } from "lucide-react";
import type { DetailPriceBreakdown } from "~/lib/board/detailTypes";

export interface SpecsPriceBreakdownProps {
  readonly breakdown: DetailPriceBreakdown;
}

const num = (value: string | null): string | null =>
  value === null
    ? null
    : Number(value).toLocaleString("ar-EG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

interface Tile {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}

function dimensionTiles(b: DetailPriceBreakdown): readonly Tile[] {
  const tiles: Tile[] = [];
  if (b.customerWidthCm !== null) {
    tiles.push({ label: "عرض العميل", value: `${b.customerWidthCm} سم` });
  }
  if (b.productionWidthCm !== null) {
    const roundedUp = b.customerWidthCm !== null && b.productionWidthCm !== b.customerWidthCm;
    tiles.push({
      label: roundedUp ? "عرض الإنتاج (مقرّب لأعلى)" : "عرض الإنتاج",
      value: `${b.productionWidthCm} سم`,
      hint: roundedUp ? `مقرب لأعلى من ${b.customerWidthCm} سم` : undefined,
    });
  }
  if (b.productionHeightM !== null) {
    tiles.push({ label: "الارتفاع", value: `${b.productionHeightM} م` });
  }
  if (b.productionAreaSqm !== null) {
    tiles.push({ label: "المساحة", value: `${b.productionAreaSqm} م²` });
  }
  return tiles;
}

function moneyTiles(b: DetailPriceBreakdown): readonly Tile[] {
  const tiles: Tile[] = [];
  if (b.baseRatePerSqm !== null) {
    tiles.push({ label: "سعر المتر المربع", value: `${num(b.baseRatePerSqm)} ج.م` });
  }
  return tiles;
}

function TilesGrid({ tiles }: { readonly tiles: readonly Tile[] }) {
  if (tiles.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col">
          <span className="text-2xs text-muted-foreground">{t.label}</span>
          <span className="font-mono text-xs font-bold text-foreground">{t.value}</span>
          {t.hint && <span className="text-2xs text-muted-foreground/80">{t.hint}</span>}
        </div>
      ))}
    </div>
  );
}

function FinishingLines({ b }: { readonly b: DetailPriceBreakdown }) {
  if (b.finishings.length === 0) return null;
  return (
    <div className="mt-3 border-t border-border/50 pt-2.5">
      <p className="mb-1.5 text-2xs font-bold text-muted-foreground">خدمات إضافية</p>
      <div className="flex flex-col gap-1">
        {b.finishings.map((line) => (
          <div
            key={`${line.labelAr}-${line.totalAmount}`}
            className="flex items-center justify-between gap-3 text-2xs"
          >
            <span className="text-foreground">
              {line.labelAr}{" "}
              <span className="text-muted-foreground">({num(line.ratePerSqm)} ج.م/م²)</span>
            </span>
            <span className="font-mono font-bold text-foreground">
              {num(line.totalAmount)} ج.م
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TotalLine({ label, value, strong }: { readonly label: string; readonly value: string; readonly strong?: boolean }) {
  if (strong) {
    return (
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/40 pt-1.5">
        <span className="font-extrabold text-foreground">{label}</span>
        <span className="font-mono text-sm font-black text-primary">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-bold text-foreground">{value}</span>
    </div>
  );
}

function Totals({ b }: { readonly b: DetailPriceBreakdown }) {
  return (
    <div className="mt-3 flex flex-col gap-1 border-t border-border/50 pt-2.5 text-2xs">
      <TotalLine label="إجمالي الأساس" value={`${num(b.baseTotal) ?? "—"} ج.م`} />
      <TotalLine
        label="إجمالي الخدمات الإضافية"
        value={`${num(b.finishingTotal) ?? "—"} ج.م`}
      />
      <TotalLine
        label="إجمالي الإنتاج"
        value={`${num(b.productionTotal) ?? "—"} ج.م`}
        strong
      />
    </div>
  );
}

export function SpecsPriceBreakdown({ breakdown }: SpecsPriceBreakdownProps) {
  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-background/50 p-3.5">
      <p className="mb-2.5 flex items-center gap-1.5 text-2xs font-bold text-muted-foreground">
        <Sparkles className="h-3 w-3 text-amber-500" />
        <span>تفاصيل التسعير كما حُسبت في الاستقبال</span>
      </p>
      <TilesGrid tiles={[...dimensionTiles(breakdown), ...moneyTiles(breakdown)]} />
      <FinishingLines b={breakdown} />
      <Totals b={breakdown} />
    </div>
  );
}