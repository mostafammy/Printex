"use client";

import React from "react";
import { User, Phone, Radio, Flame, Calendar, Sparkles } from "lucide-react";
import { CustomerSelectField } from "~/components/customers";

export interface Step1OrderMetaProps {
  readonly cashCustomer: { id: string; label: string } | null;
  readonly channel: string;
  readonly priority: string;
  readonly mode: string;
  readonly dueDate: string;
  readonly onChannelChange: (val: string) => void;
  readonly onPriorityChange: (val: string) => void;
  readonly onModeChange: (val: string) => void;
  readonly onDueDateChange: (val: string) => void;
}

const CHANNELS = [
  { value: "WALK_IN", label: "زيارة بالفرع", badge: "استقبال مباشر", icon: User },
  { value: "WHATSAPP", label: "واتساب", badge: "أونلاين", icon: Phone },
  { value: "PHONE", label: "مكالمة هاتفية", badge: "اتصال هاتفي", icon: Radio },
  { value: "RETURNING", label: "عميل دائم", badge: "إعادة طلب", icon: Sparkles },
  { value: "DIRECT_TO_DESIGNER", label: "مباشر للمصمم", badge: "تحويل مباشر", icon: User },
];

export function Step1OrderMeta({
  cashCustomer,
  channel,
  priority,
  mode,
  dueDate,
  onChannelChange,
  onPriorityChange,
  onModeChange,
  onDueDateChange,
}: Step1OrderMetaProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Customer Picker Glass Card ── */}
      <div className="rounded-3xl border border-white/20 bg-card/70 p-6 sm:p-8 shadow-xl backdrop-blur-2xl transition-all dark:border-white/10 dark:bg-card/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">بيانات العميل وحساب الطلب</h3>
            <p className="text-2xs text-muted-foreground">اختر العميل بالاسم أو رقم الهاتف، أو اختر العميل النقدي بنقرة واحدة</p>
          </div>
        </div>

        <CustomerSelectField name="customerId" required cashCustomer={cashCustomer} />
      </div>

      {/* ── Order Intake Channel Pills ── */}
      <div className="rounded-3xl border border-white/20 bg-card/70 p-6 sm:p-8 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-card/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">قناة استلام الطلب</h3>
          </div>
          <span className="text-2xs text-muted-foreground font-mono">طريقة استقبال العميل</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {CHANNELS.map((ch) => {
            const isSelected = channel === ch.value;
            const Icon = ch.icon;
            return (
              <button
                key={ch.value}
                type="button"
                onClick={() => onChannelChange(ch.value)}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-center transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/20 scale-[1.02]"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-black">{ch.label}</span>
                <span className="text-3xs px-2 py-0.5 rounded-full bg-background/80 font-bold border border-border/40">
                  {ch.badge}
                </span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="channel" value={channel} />
      </div>

      {/* ── Priority, Grouping, Due Date ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Priority */}
        <div className="rounded-3xl border border-white/20 bg-card/70 p-5 shadow-lg backdrop-blur-2xl dark:border-white/10 dark:bg-card/50 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-500" />
            <span className="text-xs font-black text-foreground">درجة الأولوية</span>
          </div>
          <div className="flex rounded-2xl bg-muted/40 p-1 border border-border/50">
            <button
              type="button"
              onClick={() => onPriorityChange("NORMAL")}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                priority === "NORMAL"
                  ? "bg-card text-foreground shadow-sm scale-100"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              عادي
            </button>
            <button
              type="button"
              onClick={() => onPriorityChange("URGENT")}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                priority === "URGENT"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/25 scale-100"
                  : "text-muted-foreground hover:text-rose-500"
              }`}
            >
              <Flame className="h-3 w-3" />
              عاجل جداً
            </button>
          </div>
          <input type="hidden" name="priority" value={priority} />
        </div>

        {/* Mode */}
        <div className="rounded-3xl border border-white/20 bg-card/70 p-5 shadow-lg backdrop-blur-2xl dark:border-white/10 dark:bg-card/50 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-black text-foreground">نمط تسليم الطلب</span>
          </div>
          <div className="flex rounded-2xl bg-muted/40 p-1 border border-border/50">
            <button
              type="button"
              onClick={() => onModeChange("GROUPED")}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                mode === "GROUPED"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              تسليم مجمع
            </button>
            <button
              type="button"
              onClick={() => onModeChange("SEPARATE")}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                mode === "SEPARATE"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              تسليم منفصل
            </button>
          </div>
          <input type="hidden" name="mode" value={mode} />
        </div>

        {/* Due Date */}
        <div className="rounded-3xl border border-white/20 bg-card/70 p-5 shadow-lg backdrop-blur-2xl dark:border-white/10 dark:bg-card/50 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs font-black text-foreground">تاريخ الاستلام المستهدف</span>
          </div>
          <input
            type="date"
            name="dueDate"
            value={dueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
            className="w-full rounded-2xl border border-border/80 bg-background/80 px-3.5 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20 shadow-2xs transition-all"
          />
        </div>
      </div>
    </div>
  );
}
