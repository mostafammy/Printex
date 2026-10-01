"use client";

import React from "react";
import { User, Flame, Calendar, Layers, CheckCircle2, ShieldCheck } from "lucide-react";
import type { OrderItemState } from "./types";

export interface Step3ReviewProps {
  readonly channel: string;
  readonly priority: string;
  readonly mode: string;
  readonly dueDate: string;
  readonly items: OrderItemState[];
  readonly isSubmitting: boolean;
  readonly onEditStep: (step: number) => void;
}

const CHANNEL_NAMES: Record<string, string> = {
  WALK_IN: "زيارة بالفرع",
  WHATSAPP: "واتساب",
  PHONE: "اتصال هاتفي",
  RETURNING: "عميل دائم",
  DIRECT_TO_DESIGNER: "مباشر للمصمم",
};

export function Step3Review({
  channel,
  priority,
  mode,
  dueDate,
  items,
  isSubmitting,
  onEditStep,
}: Step3ReviewProps) {
  const totalQuantity = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Summary Cards ── */}
      <div className="rounded-3xl border border-white/20 bg-card/70 p-6 sm:p-8 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-card/50">
        <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">بيانات الطلب والتوجيه</h3>
              <p className="text-2xs text-muted-foreground">ملخص القناة والأولوية وتاريخ التسليم</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onEditStep(1)}
            className="text-2xs font-bold text-primary hover:underline"
          >
            تعديل البيانات
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-border/50 bg-background/60 p-3">
            <span className="text-3xs font-bold text-muted-foreground">قناة الاستلام</span>
            <div className="mt-1 text-xs font-black text-foreground">{CHANNEL_NAMES[channel] ?? channel}</div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-background/60 p-3">
            <span className="text-3xs font-bold text-muted-foreground">درجة الأولوية</span>
            <div className="mt-1 flex items-center gap-1 text-xs font-black">
              {priority === "URGENT" ? (
                <span className="text-rose-600 flex items-center gap-1">
                  <Flame className="h-3 w-3" /> عاجل جداً
                </span>
              ) : (
                <span className="text-foreground">عادي</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-background/60 p-3">
            <span className="text-3xs font-bold text-muted-foreground">نمط التسليم</span>
            <div className="mt-1 text-xs font-black text-foreground">
              {mode === "GROUPED" ? "تسليم مجمع" : "تسليم منفصل"}
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-background/60 p-3">
            <span className="text-3xs font-bold text-muted-foreground">تاريخ التسليم</span>
            <div className="mt-1 flex items-center gap-1 font-mono text-xs font-black text-foreground">
              <Calendar className="h-3 w-3 text-primary" />
              {dueDate || "غير محدد"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Work Items Overview ── */}
      <div className="rounded-3xl border border-white/20 bg-card/70 p-6 sm:p-8 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-card/50">
        <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">
                أصناف العمل المطلوب تصنيعها ({items.length} صنف — إجمالي {totalQuantity} قطعة)
              </h3>
              <p className="text-2xs text-muted-foreground">تدقيق مواصفات ومقاسات كل صنف قبل إطلاق أمر التشغيل</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onEditStep(2)}
            className="text-2xs font-bold text-primary hover:underline"
          >
            تعديل الأصناف
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((it, idx) => (
            <div
              key={it.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-muted font-mono text-xs font-black text-foreground">
                  {idx + 1}
                </span>
                <div>
                  <h4 className="text-xs font-black text-foreground">
                    {it.description || `صنف #${idx + 1}`}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground mt-0.5">
                    {it.widthValue && it.heightValue && (
                      <span className="font-mono">
                        {it.widthValue} × {it.heightValue} {it.dimensionUnit}
                      </span>
                    )}
                    {it.material && <span>• {it.material}</span>}
                    {it.finishNotes && <span>• {it.finishNotes}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-primary/10 px-3 py-1 font-mono text-xs font-black text-primary">
                  {it.quantity || 1} نسخة
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ready to Launch Action Banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-linear-to-r from-primary/10 via-primary/5 to-indigo-500/10 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">جاهز لإصدار أمر العمل والطباعة</h3>
              <p className="text-xs text-muted-foreground">
                سيتم إنشاء الطلب وتوليد كروت المتابعة في لوحة الـ Kanban وتوجيهها للمحطات فوراً
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 px-7 py-3.5 text-sm font-black text-white shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>جاري حفظ وإصدار الطلب...</span>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span>إصدار أمر الشغل فوراً</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
