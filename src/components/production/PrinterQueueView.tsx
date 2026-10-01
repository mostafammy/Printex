"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Printer,
  Play,
  CheckCircle2,
  Clock,
  Flame,
  FileCheck2,
  Layers,
  ExternalLink,
  Download,
  AlertCircle,
  X,
  Loader2,
  PackageCheck,
  Search,
} from "lucide-react";
import type {
  PrinterCategory,
  PrinterQueueItem,
  PrinterQueueStats,
} from "~/server/production";
import {
  startProductionJobAction,
  completeProductionToDeliveryAction,
} from "~/app/(shell)/production/actions";
import { Button } from "~/components/ui/button";

interface PrinterQueueViewProps {
  readonly initialRows: readonly PrinterQueueItem[];
  readonly stats: PrinterQueueStats;
}

const PRINTER_TABS = [
  { id: "ALL", labelAr: "كافة الأقسام", countKey: "ALL" },
  { id: "OFFSET", labelAr: "1- أوفسيت (Offset)", countKey: "OFFSET" },
  { id: "DIGITAL", labelAr: "2- ديجيتال (Digital)", countKey: "DIGITAL" },
  { id: "LASER", labelAr: "3- ليزر (Laser)", countKey: "LASER" },
  { id: "OTHER", labelAr: "4- أخرى (Other)", countKey: "OTHER" },
] as const;

export function PrinterQueueView({
  initialRows,
  stats,
}: PrinterQueueViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"ALL" | PrinterCategory>("ALL");
  const [stateFilter, setStateFilter] = useState<"ALL" | "READY" | "IN_PRODUCTION" | "DONE">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Mark done completion notes modal state
  const [completingItem, setCompletingItem] = useState<PrinterQueueItem | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");

  async function handleStartJob(workItemId: string) {
    setActionError(null);
    setActionSuccess(null);
    setLoadingItemId(workItemId);

    const res = await startProductionJobAction(workItemId);
    setLoadingItemId(null);

    if (!res.ok) {
      setActionError(res.error ?? "فشل بدء تشغيل أمر الطباعة");
    } else {
      setActionSuccess("تم بدء تشغيل أمر الطباعة — الحالة الآن: قيد الإنتاج");
      startTransition(() => {
        router.refresh();
      });
    }
  }

  async function handleCompleteJob(e: React.FormEvent) {
    e.preventDefault();
    if (!completingItem) return;

    setActionError(null);
    setActionSuccess(null);
    setLoadingItemId(completingItem.id);

    const res = await completeProductionToDeliveryAction(
      completingItem.id,
      completionNotes.trim() ? completionNotes.trim() : undefined,
    );

    setLoadingItemId(null);
    setCompletingItem(null);
    setCompletionNotes("");

    if (!res.ok) {
      setActionError(res.error ?? "فشل إتمام أمر الطباعة");
    } else {
      setActionSuccess(
        "تم إتمام الطباعة بنجاح ونقل الطلب تلقائياً إلى: جاهز للتسليم للعميل",
      );
      startTransition(() => {
        router.refresh();
      });
    }
  }

  // Filter rows by Category, State, and Search
  const filteredRows = initialRows.filter((item) => {
    // 1. Tab / Category Filter
    if (activeTab !== "ALL" && item.printerCategory !== activeTab) {
      return false;
    }

    // 2. State Filter
    if (stateFilter === "READY" && item.state !== "READY_FOR_PRODUCTION") {
      return false;
    }
    if (stateFilter === "IN_PRODUCTION" && item.state !== "IN_PRODUCTION") {
      return false;
    }
    if (
      stateFilter === "DONE" &&
      item.state !== "READY_FOR_COLLECTION" &&
      item.state !== "PRODUCTION_COMPLETED"
    ) {
      return false;
    }

    // 3. Search Filter
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const matchNumber = item.orderNumber.toString().includes(term);
      const matchCustomer = item.customerName.toLowerCase().includes(term);
      const matchProduct = item.productName.toLowerCase().includes(term);
      if (!matchNumber && !matchCustomer && !matchProduct) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Notifications */}
      {actionError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-destructive/70 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600/70 hover:text-emerald-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.05] via-card to-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              وارد من المحاسب (بانتظار البدء)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Clock className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {stats.countsByState.READY}
            </span>
            <span className="text-xs text-muted-foreground">أمر جاهز للطباعة</span>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/[0.05] via-card to-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              قيد التشغيل والإنتاج الآن
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Play className="h-4.5 w-4.5 fill-current" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {stats.countsByState.IN_PRODUCTION}
            </span>
            <span className="text-xs text-muted-foreground">على الماكينات حالياً</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.05] via-card to-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              تم الإنتاج (جاهز للتسليم)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <PackageCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.countsByState.READY_FOR_COLLECTION}
            </span>
            <span className="text-xs text-muted-foreground">جاهز للاستلام والتوصيل</span>
          </div>
        </div>
      </div>

      {/* 4 Tabs Navigation Bar for Printer Types */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
        {/* Main Printer Type Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-4">
          {PRINTER_TABS.map((tab) => {
            const isTabActive = activeTab === tab.id;
            const count = stats.countsByCategory[tab.countKey];

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  isTabActive
                    ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/40"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{tab.labelAr}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-2xs font-extrabold ${
                    isTabActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub-Filters: State Filter + Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "ALL", label: "كافة الحالات" },
              { id: "READY", label: "بانتظار البدء (جاهز)" },
              { id: "IN_PRODUCTION", label: "قيد التشغيل" },
              { id: "DONE", label: "مكتمل وجاهز للتسليم" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStateFilter(st.id as typeof stateFilter)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  stateFilter === st.id
                    ? "bg-foreground text-background shadow-2xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ابحث برقم الطلب أو العميل أو المنتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background/80 py-1.5 ps-9 pe-3 text-xs font-semibold text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
            />
          </div>
        </div>
      </div>

      {/* Printer Queue Jobs List */}
      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 p-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-4">
            <Printer className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            لا توجد أوامر طباعة في هذا القسم أو الحالة
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            تأكد من اختيار التبويب الصحيح أو انتظر اعتماد وتسليم الطلبات من المحاسب المالي.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredRows.map((item) => {
            const isReady = item.state === "READY_FOR_PRODUCTION";
            const isRunning = item.state === "IN_PRODUCTION";
            const isDone =
              item.state === "READY_FOR_COLLECTION" ||
              item.state === "PRODUCTION_COMPLETED";
            const isLoading = loadingItemId === item.id;

            return (
              <div
                key={item.id}
                className={`relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs transition-all ${
                  isRunning
                    ? "border-blue-500/40 bg-gradient-to-br from-blue-500/[0.03] via-card to-card ring-1 ring-blue-500/25"
                    : isReady
                      ? "border-amber-500/35 bg-gradient-to-br from-amber-500/[0.02] via-card to-card"
                      : "border-emerald-500/30 bg-card"
                }`}
              >
                {/* Card Top: Order Number + Priority + Department */}
                <div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-xs border border-primary/20">
                        #{item.orderNumber}
                      </div>
                      <div>
                        <div className="font-extrabold text-foreground text-sm flex items-center gap-2">
                          <span>{item.customerName}</span>
                          {item.priority === "URGENT" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 text-2xs font-extrabold text-rose-600 dark:text-rose-400">
                              <Flame className="h-3 w-3" />
                              <span>عاجل</span>
                            </span>
                          )}
                        </div>
                        <span className="text-2xs text-muted-foreground font-semibold">
                          قسم الماكينة: {item.departmentName}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isReady && (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 text-2xs font-bold text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3 animate-pulse" />
                          <span>بانتظار البدء</span>
                        </span>
                      )}
                      {isRunning && (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-500/10 border border-blue-500/25 px-2.5 py-1 text-2xs font-bold text-blue-700 dark:text-blue-400">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                          </span>
                          <span>قيد الإنتاج والتشغيل</span>
                        </span>
                      )}
                      {isDone && (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-2xs font-bold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>جاهز للتسليم للعميل</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Product & Specifications */}
                  <div className="mt-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-bold text-sm text-foreground">
                          {item.productName}
                        </span>
                      </div>
                      <span className="rounded-lg bg-muted px-2 py-0.5 text-xs font-extrabold text-foreground">
                        الكمية: {item.quantity}
                      </span>
                    </div>

                    {item.dimensions && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold">المقاسات:</span>
                        <span className="font-mono font-bold text-foreground">
                          {item.dimensions}
                        </span>
                        {item.productionAreaSqm && (
                          <span className="text-2xs font-semibold">
                            ({item.productionAreaSqm} م²)
                          </span>
                        )}
                      </div>
                    )}

                    {item.description && (
                      <p className="text-2xs text-muted-foreground bg-muted/30 p-2 rounded-lg line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    {/* File Attachment / Version */}
                    {item.fileVersion && (
                      <div className="flex items-center justify-between text-2xs text-muted-foreground bg-muted/20 px-2.5 py-1.5 rounded-lg border border-border/50">
                        <div className="flex items-center gap-1.5 truncate">
                          <FileCheck2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="font-semibold truncate">
                            ملف التصميم المعتمد (V{item.fileVersion})
                            {item.originalFilename ? `: ${item.originalFilename}` : ""}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link href={`/production/${item.id}`} />}
                          className="h-6 px-2 text-2xs font-bold text-primary hover:text-primary"
                        >
                          <Download className="h-3 w-3 me-1" />
                          <span>تحميل الملف</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/production/${item.id}`} />}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <span>بطاقة التشغيل الكاملة</span>
                    <ExternalLink className="h-3 w-3 ms-1" />
                  </Button>

                  {/* Primary Workflow Triggers */}
                  <div>
                    {isReady && (
                      <Button
                        size="sm"
                        onClick={() => handleStartJob(item.id)}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs"
                      >
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                        <span>بدء الإنتاج والتشغيل</span>
                      </Button>
                    )}

                    {isRunning && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setCompletingItem(item);
                          setCompletionNotes("");
                        }}
                        disabled={isLoading}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>إنهاء ونقل للتسليم</span>
                      </Button>
                    )}

                    {isDone && (
                      <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <PackageCheck className="h-4 w-4" />
                        <span>مُرحل للاستقبال والتسليم</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completion Confirmation Modal */}
      {completingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-extrabold text-base text-foreground">
                  تأكيد إتمام أمر الطباعة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCompletingItem(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteJob} className="mt-4 flex flex-col gap-4">
              <div>
                <span className="text-xs font-bold text-muted-foreground">أمر العمل:</span>
                <p className="font-extrabold text-foreground text-sm mt-0.5">
                  #{completingItem.orderNumber} - {completingItem.productName} ({completingItem.customerName})
                </p>
                <p className="text-2xs text-muted-foreground mt-1">
                  سيتم تمييز أمر الطباعة كمكتمل ونقله تلقائياً إلى مرحلة &quot;جاهز للتسليم&quot; في لوحة الاستقبال.
                </p>
              </div>

              <div>
                <label
                  htmlFor="completionNotesInput"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  ملاحظات الإنتاج أو التشطيب (اختياري)
                </label>
                <textarea
                  id="completionNotesInput"
                  rows={2}
                  placeholder="مثال: تم التغليف والقص وجاهز للعميل..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                />
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCompletingItem(null)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loadingItemId === completingItem.id}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {loadingItemId === completingItem.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>تأكيد الإتمام والنقل للتسليم</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
