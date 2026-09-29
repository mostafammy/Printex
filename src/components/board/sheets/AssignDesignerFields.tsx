"use client";

/**
 * Field subcomponents for AssignDesignerSheet.
 * High-craft Apple-tier interactive designer selector with workload metrics,
 * AI recommendation highlights, keyboard navigation, and instant preview.
 * (specs/017-press-floor-board)
 */

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Clock,
  User,
  History,
  Check,
  Search,
  AlertCircle,
  TrendingUp,
  Flame,
  CheckCircle2,
} from "lucide-react";

export interface EligibleDesigner {
  readonly id: string;
  readonly name: string;
  readonly activeCount: number;
  readonly queueSize?: number;
  readonly estimatedWaitMinutes?: number;
  readonly pastJobsForCustomer?: number;
  readonly isSuggested?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "م";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0].slice(0, 1)}${parts[1]?.slice(0, 1) ?? ""}`;
}

/** Generates a consistent, rich Apple pastel gradient per designer ID/name */
function getAvatarGradient(id: string): string {
  const colors = [
    "from-indigo-500/20 via-purple-500/20 to-pink-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    "from-cyan-500/20 via-blue-500/20 to-indigo-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    "from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    "from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30",
    "from-amber-500/20 via-orange-500/20 to-rose-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % colors.length;
  return colors[idx] ?? colors[0]!;
}

function getWorkloadBadge(count: number) {
  if (count === 0) {
    return {
      label: "متاح فوراً",
      colorCls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      dotCls: "bg-emerald-500",
    };
  }
  if (count <= 2) {
    return {
      label: "عبء خفيف",
      colorCls: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
      dotCls: "bg-cyan-500",
    };
  }
  if (count <= 5) {
    return {
      label: "عبء معتدل",
      colorCls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      dotCls: "bg-amber-500",
    };
  }
  return {
    label: "مزدحم",
    colorCls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    dotCls: "bg-rose-500 animate-pulse",
  };
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-2.5 py-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/20 p-3 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted/60" />
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-28 rounded-md bg-muted/60" />
              <div className="h-3 w-16 rounded-md bg-muted/40" />
            </div>
          </div>
          <div className="h-6 w-20 rounded-full bg-muted/50" />
        </div>
      ))}
      <p className="text-center text-xs text-muted-foreground pt-1">
        جاري جلب قائمة المصممين ومعدلات الضغط...
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h4 className="text-sm font-bold text-foreground">لا يوجد مصممون متاحون حالياً</h4>
      <p className="mt-1 text-xs text-muted-foreground max-w-xs">
        لم يتم العثور على مستخدمين لديهم صلاحية التصميم النشطة في النظام.
      </p>
    </div>
  );
}

export function DesignerSelect({
  designers,
  selectedId,
  loading,
  onChange,
  onDoubleClickConfirm,
}: {
  readonly designers: readonly EligibleDesigner[];
  readonly selectedId: string;
  readonly loading: boolean;
  readonly onChange: (id: string) => void;
  readonly onDoubleClickConfirm?: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return designers;
    const q = searchQuery.toLowerCase().trim();
    return designers.filter((d) => d.name.toLowerCase().includes(q));
  }, [designers, searchQuery]);

  if (loading) return <LoadingState />;
  if (designers.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col gap-3">
      {/* Search Input when team is larger than 3 */}
      {designers.length > 3 && (
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="بحث عن مصمم بالاسم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border/70 bg-background/80 ps-9 pe-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-2xs font-semibold text-muted-foreground hover:text-foreground px-1 py-0.5 rounded"
            >
              مسح
            </button>
          )}
        </div>
      )}

      {/* Hidden select for fallback & standard accessibility binding */}
      <select
        id="assign-designer"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      >
        <option value="">اختر المصمم...</option>
        {designers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} {d.isSuggested ? "★ (مقترح)" : ""} ({d.activeCount} طلب نشط)
          </option>
        ))}
      </select>

      {/* Interactive Selection List */}
      <div
        role="radiogroup"
        aria-label="قائمة المصممين المؤهلين"
        className="flex flex-col gap-2 max-h-64 overflow-y-auto pe-1 -me-1 custom-scrollbar focus:outline-none"
      >
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            لا توجد نتائج تطابق "{searchQuery}"
          </p>
        ) : (
          filtered.map((d) => {
            const isSelected = d.id === selectedId;
            const workload = getWorkloadBadge(d.activeCount);
            const avatarGrad = getAvatarGradient(d.id);

            return (
              <div
                key={d.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => onChange(d.id)}
                onDoubleClick={() => {
                  onChange(d.id);
                  onDoubleClickConfirm?.(d.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onChange(d.id);
                  }
                }}
                className={`group relative flex items-center justify-between rounded-2xl border p-3 cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isSelected
                    ? "border-primary bg-primary/8 shadow-sm ring-2 ring-primary/30 dark:bg-primary/15 dark:border-primary"
                    : "border-border/70 bg-card/60 hover:bg-muted/40 hover:border-border hover:shadow-2xs"
                } active:scale-[0.99]`}
              >
                {/* Left Side: Avatar + Name + Metrics */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Monogram Avatar */}
                  <div
                    className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr border font-bold text-xs shadow-2xs ${avatarGrad}`}
                  >
                    <span>{getInitials(d.name)}</span>
                    {d.isSuggested && (
                      <span
                        title="المصمم المقترح ذكياً"
                        className="absolute -top-1 -start-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs"
                      >
                        <Sparkles className="h-2.5 w-2.5 fill-current" />
                      </span>
                    )}
                  </div>

                  {/* Name & Details */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold truncate ${
                          isSelected ? "text-primary dark:text-foreground" : "text-foreground"
                        }`}
                      >
                        {d.name}
                      </span>
                      {d.isSuggested && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-2xs font-bold text-emerald-700 dark:text-emerald-300">
                          <Sparkles className="h-2.5 w-2.5" />
                          <span>مقترح</span>
                        </span>
                      )}
                    </div>

                    {/* Secondary Metrics */}
                    <div className="flex items-center gap-2 mt-0.5 text-2xs text-muted-foreground">
                      <span className="font-semibold">{d.activeCount} طلب نشط</span>
                      {d.estimatedWaitMinutes !== undefined && d.estimatedWaitMinutes > 0 && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5 text-muted-foreground/80" />
                            <span>{d.estimatedWaitMinutes} دقيقة</span>
                          </span>
                        </>
                      )}
                      {d.pastJobsForCustomer !== undefined && d.pastJobsForCustomer > 0 && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-0.5 text-primary/80">
                            <History className="h-2.5 w-2.5" />
                            <span>{d.pastJobsForCustomer} للعميل</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side: Workload Status + Radio Circle */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-2xs font-bold ${workload.colorCls}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${workload.dotCls}`} />
                    <span>{workload.label}</span>
                  </span>

                  {/* Selection Indicator Circle */}
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs scale-105"
                        : "border-border/80 bg-background/50 group-hover:border-primary/50"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function ReassignReasonField({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (val: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5">
      <div className="flex items-center justify-between">
        <label
          className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5"
          htmlFor="reassign-reason"
        >
          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          <span>سبب إعادة التعيين</span>
          <span className="text-rose-500">*</span>
        </label>
        <span className="text-2xs text-muted-foreground">{value.trim().length} حرف</span>
      </div>
      <textarea
        id="reassign-reason"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        rows={2}
        placeholder="اذكر سبب تغيير المصمم (مثال: إعادة توزيع المهام، طلب العميل، تخصص التصميم)..."
        className="w-full rounded-xl border border-border/80 bg-background/90 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-2xs resize-none"
      />
    </div>
  );
}
