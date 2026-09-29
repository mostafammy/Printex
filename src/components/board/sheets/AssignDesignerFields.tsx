"use client";

/**
 * Field subcomponents for AssignDesignerSheet.
 * (specs/017-press-floor-board)
 */

import React, { useState, useMemo } from "react";
import { Sparkles, Clock, History, Check, Search, AlertCircle } from "lucide-react";

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
  return parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0].slice(0, 1)}${parts[1]?.slice(0, 1) ?? ""}`;
}

const GRADIENTS = [
  "from-indigo-500/20 via-purple-500/20 to-pink-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  "from-cyan-500/20 via-blue-500/20 to-indigo-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  "from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "from-amber-500/20 via-orange-500/20 to-rose-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
];

function getAvatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length] ?? GRADIENTS[0]!;
}

function getWorkloadBadge(count: number) {
  if (count === 0) return { label: "متاح فوراً", colorCls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", dotCls: "bg-emerald-500" };
  if (count <= 2) return { label: "عبء خفيف", colorCls: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20", dotCls: "bg-cyan-500" };
  if (count <= 5) return { label: "عبء معتدل", colorCls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20", dotCls: "bg-amber-500" };
  return { label: "مزدحم", colorCls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20", dotCls: "bg-rose-500 animate-pulse" };
}

function DesignerAvatar({ name, id, isSuggested }: { readonly name: string; readonly id: string; readonly isSuggested?: boolean }) {
  return (
    <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr border font-bold text-xs shadow-2xs ${getAvatarGradient(id)}`}>
      <span>{getInitials(name)}</span>
      {isSuggested && (
        <span title="المصمم المقترح ذكياً" className="absolute -top-1 -start-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
          <Sparkles className="h-2.5 w-2.5 fill-current" />
        </span>
      )}
    </div>
  );
}

function DesignerMeta({ designer }: { readonly designer: EligibleDesigner }) {
  return (
    <div className="flex items-center gap-2 mt-0.5 text-2xs text-muted-foreground">
      <span className="font-semibold">{designer.activeCount} طلب نشط</span>
      {Boolean(designer.estimatedWaitMinutes) && <span className="inline-flex items-center gap-0.5">• <Clock className="h-2.5 w-2.5" /> {designer.estimatedWaitMinutes} د</span>}
      {Boolean(designer.pastJobsForCustomer) && <span className="inline-flex items-center gap-0.5 text-primary/80">• <History className="h-2.5 w-2.5" /> {designer.pastJobsForCustomer} للعميل</span>}
    </div>
  );
}

function DesignerInfo({ designer, isSelected }: { readonly designer: EligibleDesigner; readonly isSelected: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <DesignerAvatar name={designer.name} id={designer.id} isSuggested={designer.isSuggested} />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold truncate ${isSelected ? "text-primary dark:text-foreground" : "text-foreground"}`}>{designer.name}</span>
          {designer.isSuggested && <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-2xs font-bold text-emerald-700 dark:text-emerald-300">مقترح</span>}
        </div>
        <DesignerMeta designer={designer} />
      </div>
    </div>
  );
}

function DesignerStatus({ count, isSelected }: { readonly count: number; readonly isSelected: boolean }) {
  const workload = getWorkloadBadge(count);
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-bold ${workload.colorCls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${workload.dotCls}`} />
        <span>{workload.label}</span>
      </span>
      <div className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border/80 bg-background/50"}`}>
        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
      </div>
    </div>
  );
}

function DesignerCardItem({
  designer,
  isSelected,
  onSelect,
  onDoubleClick,
}: {
  readonly designer: EligibleDesigner;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDoubleClick?: (id: string) => void;
}) {
  const cardCls = isSelected
    ? "border-primary bg-primary/8 shadow-sm ring-2 ring-primary/30 dark:bg-primary/15 dark:border-primary"
    : "border-border/70 bg-card/60 hover:bg-muted/40 hover:border-border hover:shadow-2xs";

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={() => onSelect(designer.id)}
      onDoubleClick={() => onDoubleClick?.(designer.id)}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onSelect(designer.id); } }}
      className={`group relative flex items-center justify-between rounded-2xl border p-3 cursor-pointer transition-all duration-200 active:scale-[0.99] ${cardCls}`}
    >
      <DesignerInfo designer={designer} isSelected={isSelected} />
      <DesignerStatus count={designer.activeCount} isSelected={isSelected} />
    </div>
  );
}

function SearchBox({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        placeholder="بحث عن مصمم بالاسم..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border/70 bg-background/80 ps-9 pe-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all shadow-2xs"
      />
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

  if (loading) return <p className="py-4 text-center text-xs text-muted-foreground">جاري جلب قائمة المصممين...</p>;
  if (designers.length === 0) return <p className="py-4 text-center text-xs text-muted-foreground">لا يوجد مصممون متاحون</p>;

  return (
    <div className="flex flex-col gap-3">
      {designers.length > 3 && <SearchBox value={searchQuery} onChange={setSearchQuery} />}
      <div role="radiogroup" aria-label="قائمة المصممين المؤهلين" className="flex flex-col gap-2 max-h-64 overflow-y-auto pe-1 -me-1 custom-scrollbar focus:outline-none">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">لا توجد نتائج مطابقة</p>
        ) : (
          filtered.map((d) => (
            <DesignerCardItem key={d.id} designer={d} isSelected={d.id === selectedId} onSelect={onChange} onDoubleClick={onDoubleClickConfirm} />
          ))
        )}
      </div>
    </div>
  );
}

export function ReassignReasonField({ value, onChange }: { readonly value: string; readonly onChange: (val: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5" htmlFor="reassign-reason">
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
        placeholder="اذكر سبب تغيير المصمم..."
        className="w-full rounded-xl border border-border/80 bg-background/90 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-2xs resize-none"
      />
    </div>
  );
}
