"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Layers,
  Printer,
  Receipt,
  Search,
  Tag,
  X,
  FileCheck2,
  DollarSign,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type {
  AccountantOrderItem,
  AccountantOrderRow,
  AccountantOrdersMetrics,
} from "~/server/accounting";
import { approveAccountantOrderItemAction } from "~/app/(shell)/accounting/orders/actions";
import { Button } from "~/components/ui/button";

import { AccountantPriceBreakdown } from "./AccountantPriceBreakdown";

interface AccountantOrdersViewProps {
  readonly initialOrders: readonly AccountantOrderRow[];
  readonly metrics: AccountantOrdersMetrics;
  readonly selectedDay: string;
  readonly dayLabel: string;
}

export function AccountantOrdersView({
  initialOrders,
  metrics,
  selectedDay,
  dayLabel,
}: AccountantOrdersViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? "ALL",
  );
  const [searchTerm, setSearchTerm] = useState<string>(
    searchParams.get("search") ?? "",
  );
  const [customDate, setCustomDate] = useState<string>(
    /^\d{4}-\d{2}-\d{2}$/.test(selectedDay) ? selectedDay : "",
  );

  const [, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  // Edit price dialog state
  const [editingItem, setEditingItem] = useState<{
    id: string;
    productName: string;
    currentAmount: number;
  } | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>("");
  const [editPriceNote, setEditPriceNote] = useState<string>("");

  // Which item's pricing breakdown is open. Single-open rather than a Set: one
  // expanded row is all an accountant needs to read, and it keeps the toggle
  // state trivial.
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`/accounting/orders?${params.toString()}`);
    });
  }

  function handleDaySelect(dayValue: string) {
    applyFilter("day", dayValue);
  }

  function handleCustomDateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (customDate) {
      applyFilter("day", customDate);
    }
  }

  function handleStatusChange(status: string) {
    setStatusFilter(status);
    applyFilter("status", status);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilter("search", searchTerm);
  }

  async function handleApprove(workItemId: string) {
    setActionError(null);
    setActionSuccess(null);
    setLoadingItemId(workItemId);

    const res = await approveAccountantOrderItemAction(workItemId);
    setLoadingItemId(null);

    if (!res.ok) {
      setActionError(res.error ?? "فشل اعتماد الطلب");
    } else {
      setActionSuccess("تم اعتماد الصنف بنجاح وإرساله لمرحلة الطباعة");
      startTransition(() => {
        router.refresh();
      });
    }
  }

  async function handleSaveEditedPrice(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    setActionError(null);
    setActionSuccess(null);
    setLoadingItemId(editingItem.id);

    const res = await approveAccountantOrderItemAction(editingItem.id, {
      customPrice: editPriceValue,
      note: editPriceNote.trim() ? editPriceNote : "تعديل واعتماد السعر من سجل المحاسب",
    });

    setLoadingItemId(null);
    setEditingItem(null);

    if (!res.ok) {
      setActionError(res.error ?? "فشل تعديل السعر واعتماد الطلب");
    } else {
      setActionSuccess("تم تحديث السعر واعتماد الصنف بنجاح وإرساله للطباعة");
      startTransition(() => {
        router.refresh();
      });
    }
  }

  // Filter orders by search term in client for instant feedback
  const displayedOrders = initialOrders.filter((order) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      order.orderNumber.toString().includes(term) ||
      order.customerName.toLowerCase().includes(term) ||
      order.workItems.some((w) => w.productName.toLowerCase().includes(term))
    );
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

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              إجمالي طلبات الفترة
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {metrics.totalOrders}
            </span>
            <span className="text-xs text-muted-foreground">طلب</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.04] to-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              بانتظار اعتماد المحاسب
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {metrics.pendingCount}
            </span>
            <span className="text-xs text-amber-700/80 dark:text-amber-400/80">
              طلب جاهز للمراجعة
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.04] to-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              تم اعتمادها وإرسالها للطباعة
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {metrics.approvedCount}
            </span>
            <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
              طلب مُرحل للإنتاج
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              القيمة المالية الإجمالية
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/60 text-foreground">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-foreground">
              {metrics.totalAmount.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-muted-foreground">ج.م</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Day Filter + Search + Status */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
        {/* Day Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground ms-1 me-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              <span>تصفية حسب اليوم:</span>
            </span>

            <button
              type="button"
              onClick={() => handleDaySelect("today")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                selectedDay === "today" || (!searchParams.get("day") && dayLabel.startsWith("اليوم"))
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              اليوم
            </button>

            <button
              type="button"
              onClick={() => handleDaySelect("yesterday")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                selectedDay === "yesterday" || searchParams.get("day") === "yesterday"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              أمس
            </button>

            <button
              type="button"
              onClick={() => handleDaySelect("last7days")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                selectedDay === "last7days" || searchParams.get("day") === "last7days"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              آخر 7 أيام
            </button>

            <button
              type="button"
              onClick={() => handleDaySelect("all")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                selectedDay === "all" || searchParams.get("day") === "all"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              جميع الأيام
            </button>
          </div>

          {/* Date Picker Form */}
          <form
            onSubmit={handleCustomDateSubmit}
            className="flex items-center gap-2"
          >
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="text-xs font-semibold"
            >
              تطبيق التاريخ
            </Button>
          </form>
        </div>

        {/* Status Tabs + Search */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "ALL", label: "كافة الطلبات" },
              { id: "PENDING", label: "بانتظار الاعتماد" },
              { id: "APPROVED", label: "تم الاعتماد والإرسال" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleStatusChange(tab.id)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  statusFilter === tab.id
                    ? "bg-foreground text-background shadow-2xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
            <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ابحث برقم الطلب أو اسم العميل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background/80 py-1.5 ps-9 pe-3 text-xs font-semibold text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
            />
          </form>
        </div>
      </div>

      {/* Orders List */}
      {displayedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 p-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-4">
            <Receipt className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            لا توجد طلبات في هذا اليوم أو التصفية المحددة
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            يمكنك تغيير فلتر اليوم لاختيار &quot;جميع الأيام&quot; أو يوم آخر، أو التحقق من التصفية الحالية.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayedOrders.map((order) => {
            const hasPendingItems = order.workItems.some(
              (w) => w.state === "WAITING_PRICING",
            );

            return (
              <div
                key={order.orderId}
                className={`rounded-2xl border bg-card p-5 shadow-xs transition-all ${
                  hasPendingItems
                    ? "border-amber-500/35 bg-gradient-to-br from-amber-500/[0.02] via-card to-card ring-1 ring-amber-500/20"
                    : "border-border/70 hover:border-border"
                }`}
              >
                {/* Order Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-sm border border-amber-500/20">
                      #{order.orderNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-foreground text-sm">
                          {order.customerName}
                        </span>
                        {order.priority === "URGENT" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 text-2xs font-extrabold text-rose-600 dark:text-rose-400">
                            <Flame className="h-3 w-3" />
                            <span>عاجل</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-2xs text-muted-foreground mt-0.5">
                        <span>قناة الطلب: {order.channel}</span>
                        <span>•</span>
                        <span>
                          تاريخ الإنشاء: {new Date(order.createdAt).toLocaleDateString("ar-EG")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${
                        hasPendingItems
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {hasPendingItems ? (
                        <>
                          <Clock className="h-3.5 w-3.5 animate-pulse" />
                          <span>بانتظار اعتماد المحاسب</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{order.currentStageLabelAr}</span>
                        </>
                      )}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/orders/${order.orderId}`} />}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      <span>عرض تفاصيل الطلب</span>
                      <ExternalLink className="h-3 w-3 ms-1" />
                    </Button>
                  </div>
                </div>

                {/* Items in Order */}
                <div className="mt-3.5 flex flex-col gap-2.5">
                  {order.workItems.map((item) => {
                    const isItemPending = item.state === "WAITING_PRICING";
                    const isItemLoading = loadingItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 border transition-colors ${
                          isItemPending
                            ? "border-amber-500/25 bg-amber-500/[0.04]"
                            : "border-border/60 bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card border border-border/80 text-muted-foreground">
                            <Layers className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground">
                                {item.productName}
                              </span>
                              {item.quantity > 1 && (
                                <span className="rounded-md bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">
                                  الكمية: {item.quantity}
                                </span>
                              )}
                              {item.dimensions && (
                                <span className="text-2xs text-muted-foreground font-mono">
                                  [{item.dimensions}]
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-2xs text-muted-foreground line-clamp-1 mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Price & Action */}
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col text-end">
                            <span className="font-mono text-sm font-extrabold text-foreground">
                              {(item.productionTotal ?? item.baseTotal ?? 0).toLocaleString()} ج.م
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedItemId((cur) =>
                                  cur === item.id ? null : item.id,
                                )
                              }
                              className="text-2xs font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
                              aria-expanded={expandedItemId === item.id}
                            >
                              {expandedItemId === item.id
                                ? "إخفاء تفاصيل التسعير"
                                : "عرض تفاصيل التسعير"}
                            </button>
                            <span className="text-2xs text-muted-foreground">
                              {item.pricingStatus === "PENDING"
                                ? "تسعير مقترح"
                                : item.pricingStatus === "PRICED"
                                  ? "سعر معتمد"
                                  : "تسعير مالي"}
                            </span>
                          </div>

                          {/* Approval / Status actions */}
                          {isItemPending ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(item.id)}
                                disabled={isItemLoading}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs"
                              >
                                {isItemLoading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Printer className="h-3.5 w-3.5" />
                                )}
                                <span>اعتماد وإرسال للطباعة</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingItem({
                                    id: item.id,
                                    productName: item.productName,
                                    currentAmount:
                                      item.productionTotal ?? item.baseTotal ?? 0,
                                  });
                                  setEditPriceValue(
                                    (item.productionTotal ?? item.baseTotal ?? 0).toString(),
                                  );
                                  setEditPriceNote("");
                                }}
                                className="text-xs"
                              >
                                تعديل السعر...
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-2xs font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>مُعتمد ومُرسل للطباعة</span>
                              </span>
                              {item.approvedByName && (
                                <span className="text-2xs text-muted-foreground">
                                  بواسطة: {item.approvedByName}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {expandedItemId === item.id && (
                          <div className="w-full">
                            <AccountantPriceBreakdown item={item} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Order Footer Summary */}
                <div className="mt-3.5 flex items-center justify-between text-xs text-muted-foreground pt-2.5 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    <span>عدد الأصناف: {order.workItems.length}</span>
                    {order.latestApprovedAt && (
                      <>
                        <span>•</span>
                        <span>
                          آخر اعتماد: {new Date(order.latestApprovedAt).toLocaleTimeString("ar-EG")}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <span>إجمالي الطلب:</span>
                    <span className="font-mono text-sm text-primary">
                      {order.totalAmount.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Price Modal Dialog */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-amber-500" />
                <h3 className="font-extrabold text-base text-foreground">
                  تعديل واعتماد سعر الصنف
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedPrice} className="mt-4 flex flex-col gap-4">
              <div>
                <span className="text-xs font-bold text-muted-foreground">المنتج:</span>
                <p className="font-extrabold text-foreground text-sm mt-0.5">
                  {editingItem.productName}
                </p>
              </div>

              <div>
                <label
                  htmlFor="editPriceInput"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  السعر الإجمالي المعتمد (ج.م) *
                </label>
                <input
                  id="editPriceInput"
                  type="number"
                  step="0.01"
                  required
                  value={editPriceValue}
                  onChange={(e) => setEditPriceValue(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm font-bold text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="editPriceNote"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  سبب أو ملاحظة التعديل (اختياري)
                </label>
                <textarea
                  id="editPriceNote"
                  rows={2}
                  placeholder="مثال: خصم إضافي للعميل، تعديل تكلفة الخامة..."
                  value={editPriceNote}
                  onChange={(e) => setEditPriceNote(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                />
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingItem(null)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loadingItemId === editingItem.id}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  {loadingItemId === editingItem.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Printer className="h-3.5 w-3.5" />
                  )}
                  <span>حفظ السعر والإرسال للطباعة</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
