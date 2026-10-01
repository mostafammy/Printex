"use client";

import React, { useState, useId } from "react";
import { useRouter } from "next/navigation";
import {
  Printer,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Layers,
  UserPlus,
  UserCheck,
  Save,
  Ban,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type {
  ClientDepartment,
  ClientProductType,
  CustomerSummary,
  DesignerSummary,
  FinishingServiceOption,
  JobCategory,
  MasterOrderItem,
  BannerJobSpec,
  ProductionGovernance,
} from "./types";
import { BannerJobModal } from "./BannerJobModal";
import { GenericJobModal } from "./GenericJobModal";
import { CustomerSelectModal } from "./CustomerSelectModal";
import {
  createMasterOrderAction,
  quickCreateCustomerAction,
} from "~/app/(shell)/reception/new/actions";

export interface MasterPrintOrderViewProps {
  readonly preGeneratedOrderNumber: string;
  readonly defaultOrderDate: string;
  readonly defaultDueDate: string;
  readonly salesRepName: string;
  readonly customers: readonly CustomerSummary[];
  readonly cashCustomer: CustomerSummary | null;
  readonly departments: readonly ClientDepartment[];
  readonly productTypes: readonly ClientProductType[];
  /**
   * Designers reception may hand the job to. Assignment is MANDATORY before an
   * order may leave reception (see the `DESIGNER_REQUIRED` guard in
   * `server/pipeline/guards.ts`), so this list is not optional — an empty one
   * is surfaced as a blocker rather than an empty dropdown.
   */
  readonly designers: readonly DesignerSummary[];
  /** 093 production configuration per product type (ladder, height cap, rate band). */
  readonly governance: Readonly<Record<string, ProductionGovernance>>;
  /** The extensible finishing catalogue the receptionist may add on top. */
  readonly finishingServices: readonly FinishingServiceOption[];
}

const PRINT_CATEGORIES: readonly {
  category: JobCategory;
  titleAr: string;
  descAr: string;
  iconBg: string;
}[] = [
  {
    category: "OFFSET",
    titleAr: "1. طباعة أوفست (Offset Printing)",
    descAr: "كميات كبيرة، علب، كتب، مجلات وبنر",
    iconBg: "from-amber-500 to-orange-600",
  },
  {
    category: "DIGITAL",
    titleAr: "2. طباعة ديجيتال (Digital Printing)",
    descAr: "طباعة فورية، كروت، فوتو، أوراق",
    iconBg: "from-blue-500 to-indigo-600",
  },
  {
    category: "SILK_SCREEN",
    titleAr: "3. سلك سكرين (Silk Screen)",
    descAr: "ملابس، تيشيرتات، هدايا، قماش",
    iconBg: "from-emerald-500 to-teal-600",
  },
  {
    category: "BANNER_FLEX",
    titleAr: "4. بانر وفليكس (Banner & Flex)",
    descAr: "لافتات، أوت دور، استيكر، ميش",
    iconBg: "from-orange-500 to-red-600",
  },
  {
    category: "LASER",
    titleAr: "5. ماكينات ليزر (Laser Machines)",
    descAr: "قص وحفر أكريليك، خشب، دروع",
    iconBg: "from-purple-500 to-indigo-600",
  },
  {
    category: "OTHER",
    titleAr: "6. مطبوعات أخرى (Other Prints)",
    descAr: "مطبوعات مخصصة ومواصفات حرة",
    iconBg: "from-slate-500 to-zinc-600",
  },
];

/**
 * Two decimal places, without the float dust.
 *
 * `Math.round(x * 100) / 100` returns a double, and `toFixed(2)` on the result
 * rounds *again* — so a displayed "570.00" could be carrying 569.9999999999999
 * into the payload. Rounding at the point of display AND of submission is what
 * keeps the two from disagreeing; the server re-rounds to `Decimal(12,2)` on the
 * way in, which is the same rule.
 *
 * A non-finite input is treated as zero rather than propagated: `NaN` reaching
 * the form would render as "NaN ج.م" and, if it were ever submitted, would fail
 * the server's `toMoney` with a message the receptionist cannot act on.
 */
function toMoney2dp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function MasterPrintOrderView({
  preGeneratedOrderNumber,
  defaultOrderDate,
  defaultDueDate,
  salesRepName,
  customers,
  cashCustomer,
  departments,
  productTypes,
  designers,
  governance,
  finishingServices,
}: MasterPrintOrderViewProps) {
  const router = useRouter();
  const generatedId = useId();

  // Section 1: Customer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Section 2: Order Info
  const [orderDate, setOrderDate] = useState(defaultOrderDate);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(defaultDueDate);
  const [orderStatus, setOrderStatus] = useState("PENDING");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [salesRep, setSalesRep] = useState(salesRepName);

  /**
   * The designer the job is handed to. MANDATORY.
   *
   * The RECEPTION → DESIGNER edge is the first mandatory stage of the pipeline,
   * and `assignDesigner` is what moves a Work Item out of `NEW`. An order saved
   * without one would sit in reception as work nobody owns, which is exactly
   * what the `DESIGNER_REQUIRED` guard refuses to let reach production. So it is
   * validated here (for the receptionist's benefit) AND again on the server.
   */
  const [designerId, setDesignerId] = useState<string>("");

  // Section 4: Jobs
  const [jobs, setJobs] = useState<MasterOrderItem[]>([]);

  // Modals state
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [genericModalCategory, setGenericModalCategory] = useState<JobCategory | null>(null);

  // Section 5: Financials
  //
  // Discount and tax are STORED on the Order (`discountAmount` / `taxAmount`),
  // so unlike the total they are real records, not a preview. The total itself
  // stays derived server-side — `computeOrderSummary` combines the work items'
  // prices with those two columns — and the arithmetic below deliberately
  // mirrors `total = subtotal - discount + tax` there, so the number on screen
  // is the number that gets stored.
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [discountValue, setDiscountValue] = useState<number>(0);

  const [taxType, setTaxType] = useState<"FIXED" | "PERCENT">("PERCENT");
  const [taxValue, setTaxValue] = useState<number>(14);

  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // The sum of the frozen production totals of every job on this order. Each one
  // came out of `deriveProductionSpec` — production width, area, base + every
  // finishing — so the add-ons are already in here.
  const subtotal = toMoney2dp(jobs.reduce((sum, j) => sum + j.totalCost, 0));

  // Discount first, then tax on what is left. Taxing before discounting would
  // charge tax on money that was then given away, and the order row would not
  // add up.
  const calculatedDiscount = toMoney2dp(
    discountType === "FIXED" ? Math.min(discountValue, subtotal) : (subtotal * discountValue) / 100,
  );
  const afterDiscount = toMoney2dp(Math.max(0, subtotal - calculatedDiscount));
  const calculatedTax = toMoney2dp(taxType === "FIXED" ? taxValue : (afterDiscount * taxValue) / 100);
  const grandTotal = toMoney2dp(afterDiscount + calculatedTax);

  // Remaining Balance
  const remainingBalance = Math.max(0, toMoney2dp(grandTotal - paidAmount));

  // Payment Status
  let paymentStatus: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
  if (paidAmount >= grandTotal && grandTotal > 0) {
    paymentStatus = "PAID";
  } else if (paidAmount > 0) {
    paymentStatus = "PARTIAL";
  }

  // Handlers for adding jobs
  const handleOpenCategory = (cat: JobCategory) => {
    if (cat === "OFFSET" || cat === "BANNER_FLEX") {
      setIsBannerModalOpen(true);
    } else {
      setGenericModalCategory(cat);
    }
  };

  const handleSaveBannerJob = (bannerSpec: BannerJobSpec) => {
    const item: MasterOrderItem = {
      id: bannerSpec.id,
      category: "BANNER_FLEX",
      categoryLabelAr: "بنر وفليكس (أوفست)",
      jobName: bannerSpec.jobName,
      quantity: bannerSpec.quantity,
      // The legacy WorkItem columns carry the CUSTOMER's dimensions, both in
      // centimetres — the same unit for both, and the numbers the designer lays
      // out and the printer physically cuts. The rounded-up BILLING width stays
      // on `bannerSpec` and reaches the money path only.
      width: bannerSpec.customerWidthCm,
      height: bannerSpec.heightCm,
      measurementUnit: "CM",
      unit: bannerSpec.unit === "PIECES" ? "قطع" : "م²",
      material: `${bannerSpec.printType} - ${bannerSpec.materialWeight}`,
      finishing: bannerSpec.finishingLines.map((f) => f.labelAr).join("، "),
      notes: bannerSpec.notes,
      totalCost: bannerSpec.total,
      departmentId: bannerSpec.departmentId,
      productTypeId: bannerSpec.productTypeId,
      requiresDesign: bannerSpec.requiresDesign,
      bannerSpec,
    };

    setJobs((prev) => [...prev, item]);
  };

  const handleSaveGenericJob = (item: MasterOrderItem) => {
    setJobs((prev) => [...prev, item]);
  };

  const handleDeleteJob = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const handleSaveOrder = async () => {
    if (!selectedCustomer) {
      setSaveError("يرجى اختيار أو تسجيل عميل للطلب أولاً");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (jobs.length === 0) {
      setSaveError("يرجى إضافة شغلانة واحدة على الأقل قبل حفظ أمر الطباعة");
      window.scrollTo({ top: 300, behavior: "smooth" });
      return;
    }

    // Mandatory: the order may not leave reception without a designer. This is
    // a convenience check, not the enforcement — `createMasterOrderAction`
    // re-checks it and refuses, and the pipeline guard re-checks it again on
    // every transition out of reception.
    if (!designerId) {
      setSaveError("يجب تعيين مصمم قبل حفظ أمر الطباعة — لا يمكن للأمر مغادرة الاستقبال بدون مصمم");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (designers.length === 0) {
      setSaveError("لا يوجد مصممين مسجلين في النظام — راجع مدير النظام قبل حفظ الطلب");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const res = await createMasterOrderAction({
        customerId: selectedCustomer.id,
        priority,
        dueDate: expectedDeliveryDate || undefined,
        salesRep,
        designerId,
        // Sent as the two resolved EGP amounts, not as "type + value": the
        // server stores an amount, and letting it re-derive a percentage would
        // mean two implementations of the same rule that can drift. The KIND
        // travels separately so the order records how the figure was reached.
        discountAmount: calculatedDiscount,
        discountKind: discountType,
        taxAmount: calculatedTax,
        taxKind: taxType,
        paidAmount,
        items: jobs,
      });

      router.push(`/orders/${res.orderId}`);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "حدث خطأ أثناء حفظ أمر الطباعة"
      );
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* ── 1. Header & Actions (الترويسة والإجراءات) ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs bg-gradient-to-br from-primary/5 via-card to-card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-blue-600 to-indigo-700 text-white shadow-md shadow-primary/25">
              <Printer className="h-8 w-8" />
              <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  إصدار أمر طباعة جديد (Master Print Order)
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary font-mono">
                  {preGeneratedOrderNumber}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                تسجيل ومطابقة أوامر الطباعة، مواصفات البنر والأوفست وحساب الإجماليات والمستحقات
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => router.push("/reception")}
              className="gap-2 rounded-xl border-border/80"
            >
              <Ban className="h-4 w-4" />
              <span>إلغاء (Cancel)</span>
            </Button>

            <Button
              type="button"
              variant="default"
              size="default"
              disabled={isSaving}
              onClick={handleSaveOrder}
              className="gap-2 rounded-xl bg-primary hover:bg-primary/90 font-bold px-6 shadow-md shadow-primary/25"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "جاري الحفظ..." : "حفظ أمر الطباعة (Save Print Order)"}</span>
            </Button>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* ── 2. Section 1: Customer Selection (بيانات العميل وشريك الأعمال) ── */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
              1
            </span>
            <h2 className="text-base font-bold text-foreground">
              بيانات العميل وشريك الأعمال (Customer Selection)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCustomerModalOpen(true)}
              className="gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-bold"
            >
              <UserPlus className="h-4 w-4" />
              <span>اختيار أو إضافة عميل (Select Customer)</span>
            </Button>
          </div>
        </div>

        {selectedCustomer ? (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white font-black shadow-xs">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {selectedCustomer.name}
                  </span>
                  {selectedCustomer.isCashCustomer ? (
                    <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-3xs font-bold text-amber-700 dark:text-amber-300">
                      عميل نقدي
                    </span>
                  ) : (
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-3xs font-bold text-emerald-700 dark:text-emerald-300">
                      عميل مسجل
                    </span>
                  )}
                </div>
                {selectedCustomer.phone ? (
                  <span className="text-xs text-muted-foreground font-mono">
                    هاتف: {selectedCustomer.phone}
                  </span>
                ) : null}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCustomer(null)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              تغيير العميل
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
            <span className="text-xs font-semibold text-muted-foreground block mb-2">
              حالة العميل: لم يتم اختيار عميل بعد (No customer selected yet)
            </span>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setIsCustomerModalOpen(true)}
              className="rounded-xl font-bold"
            >
              اختيار العميل
            </Button>
          </div>
        )}
      </div>

      {/* ── 3. Section 2: Order Information (البيانات الأساسية للطلب) ── */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
        <div className="border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
              2
            </span>
            <h2 className="text-base font-bold text-foreground">
              البيانات الأساسية للطلب (Order Information)
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Order Number */}
          <div>
            <label htmlFor={`order-number-${generatedId}`} className="block text-xs font-bold text-muted-foreground mb-1.5">
              رقم الطلب (Order Number)
            </label>
            <input
              id={`order-number-${generatedId}`}
              type="text"
              readOnly
              value={preGeneratedOrderNumber}
              className="w-full rounded-xl border border-border/60 bg-muted/50 px-3.5 py-2.5 text-sm font-mono font-bold text-foreground outline-none"
            />
          </div>

          {/* Order Date */}
          <div>
            <label htmlFor={`order-date-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
              تاريخ الطلب (Order Date)
            </label>
            <input
              id={`order-date-${generatedId}`}
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Expected Delivery Date */}
          <div>
            <label htmlFor={`expected-delivery-date-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
              تاريخ التسليم المتوقع (Expected Delivery Date)
            </label>
            <input
              id={`expected-delivery-date-${generatedId}`}
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Order Status */}
          <div>
            <label htmlFor={`order-status-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
              حالة الطلب (Order Status)
            </label>
            <select
              id={`order-status-${generatedId}`}
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
            >
              <option value="PENDING">قيد الانتظار - Pending</option>
              <option value="NEW">جديد - New</option>
              <option value="IN_PROGRESS">قيد التشغيل - In Progress</option>
            </select>
          </div>

          {/* Priority Level */}
          <div>
            <label htmlFor={`priority-level-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
              درجة الأولوية (Priority Level)
            </label>
            <select
              id={`priority-level-${generatedId}`}
              value={priority}
              onChange={(e) => setPriority(e.target.value as "NORMAL" | "URGENT")}
              className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
            >
              <option value="NORMAL">عادية - Normal</option>
              <option value="URGENT">عاجلة - Urgent 🔥</option>
            </select>
          </div>

          {/* Sales Rep */}
          <div>
            <label htmlFor={`sales-rep-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
              مسؤول المبيعات (Sales Rep)
            </label>
            <input
              id={`sales-rep-${generatedId}`}
              type="text"
              value={salesRep}
              onChange={(e) => setSalesRep(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Designer — MANDATORY. Reception is the entry point of the
              RECEPTION → DESIGNER → ACCOUNTANT → (BRANDING) → PRINTER pipeline,
              and an order may not become an executable designer task without an
              owner. Refusing here is a courtesy for the receptionist; the server
              refuses regardless, and the pipeline guard refuses again. */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label
              htmlFor={`designer-${generatedId}`}
              className="block text-xs font-bold text-foreground mb-1.5"
            >
              المصمم المسؤول (Assigned Designer)
              <span className="ms-1 text-destructive">*</span>
              <span className="ms-1.5 font-normal text-muted-foreground">
                إلزامي — لا يمكن للأمر مغادرة الاستقبال بدون مصمم
              </span>
            </label>
            <select
              id={`designer-${generatedId}`}
              value={designerId}
              onChange={(e) => setDesignerId(e.target.value)}
              required
              className={`w-full rounded-xl border bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground focus:outline-none ${
                designers.length > 0 && designerId.length === 0
                  ? "border-destructive/70 focus:border-destructive"
                  : "border-border/80 focus:border-primary"
              }`}
            >
              <option value="">
                {designers.length === 0
                  ? "لا يوجد مصممين مسجلين — راجع مدير النظام"
                  : "اختر المصمم المسؤول عن الشغلانة..."}
              </option>
              {designers.map((designer) => (
                <option key={designer.id} value={designer.id}>
                  {designer.name}
                  {designer.username ? ` (${designer.username})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── 4. Section 3: Print Category / Department (نوع الطباعة) ── */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
        <div className="border-b border-border/50 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
              3
            </span>
            <h2 className="text-base font-bold text-foreground">
              نوع الطباعة (Print Category / Department)
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            اضغط على القسم المطلوب لفتح وإعداد الشغلانة مباشرة
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {PRINT_CATEGORIES.map((cat) => (
            <button
              key={cat.category}
              type="button"
              onClick={() => handleOpenCategory(cat.category)}
              className="flex items-start gap-3.5 rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-4 text-start hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${cat.iconBg} text-white shadow-xs group-hover:scale-105 transition-transform`}
              >
                <Layers className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors block">
                  {cat.titleAr}
                </span>
                <span className="text-2xs text-muted-foreground mt-0.5 block">
                  {cat.descAr}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── 5. Section 4: Jobs Added to this Order (الشغلانات المضافة داخل هذا الأمر) ── */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
              4
            </span>
            <h2 className="text-base font-bold text-foreground">
              الشغلانات المضافة داخل هذا الأمر ({jobs.length} شغلانة)
            </h2>
          </div>

          {/* Quick Add Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => setIsBannerModalOpen(true)}
              className="gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold shadow-xs text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ أوفست (بنر وفليكس)</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setGenericModalCategory("DIGITAL")}
              className="gap-1.5 rounded-xl border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ ديجيتال</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setGenericModalCategory("SILK_SCREEN")}
              className="gap-1.5 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ سلك سكرين</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setGenericModalCategory("LASER")}
              className="gap-1.5 rounded-xl border-purple-500/30 text-purple-600 dark:text-purple-400 font-bold text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ ماكينات ليزر</span>
            </Button>
          </div>
        </div>

        {jobs.length > 0 ? (
          <div className="space-y-3">
            {jobs.map((job, idx) => (
              <div
                key={job.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/60 p-4 shadow-2xs hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {job.jobName}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-3xs font-semibold text-muted-foreground">
                        {job.categoryLabelAr}
                      </span>
                    </div>

                    {/* A governed roll job shows BOTH widths side by side. Collapsing them
                        into one "الأبعاد" number is what hides the difference
                        between the width the customer is charged on and the
                        width the job is actually produced at. */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>الكمية: {job.quantity} {job.unit ?? "قطع"}</span>
                      {job.bannerSpec ? (
                        <>
                          <span className="font-mono">
                            عرض العميل: {job.bannerSpec.customerWidthCm} سم
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            عرض التسعير: {job.bannerSpec.productionWidthCm} سم
                          </span>
                          <span className="font-mono">
                            الطول: {job.bannerSpec.heightCm} سم
                          </span>
                          <span className="font-mono">
                            المساحة: {job.bannerSpec.totalAreaSqm} م²
                          </span>
                        </>
                      ) : job.width && job.height ? (
                        <span>
                          الأبعاد: {job.width} × {job.height} {job.measurementUnit ?? "سم"}
                        </span>
                      ) : null}
                      {job.material ? <span>الخامة: {job.material}</span> : null}
                      {job.finishing ? <span>التشطيب: {job.finishing}</span> : null}
                      {job.bannerSpec?.requiresDesign !== undefined ? (
                        <span className={job.bannerSpec.requiresDesign ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-emerald-600 dark:text-emerald-400 font-semibold"}>
                          {job.bannerSpec.requiresDesign ? "المصمم سيعمل على التصميم" : "التصميم جاهز للطباعة"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div className="text-end">
                    <span className="text-3xs text-muted-foreground block">التكلفة</span>
                    <span className="text-base font-black text-foreground font-mono">
                      {job.totalCost.toFixed(2)} ج.م
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteJob(job.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs font-semibold text-muted-foreground">
              لم يتم إضافة أي شغلانات داخل هذا الأمر بعد
            </p>
            <p className="text-3xs text-muted-foreground mt-0.5">
              استخدم أزرار الإضافة السريعة أعلاه أو اختر القسم المناسب لإضافة مواصفات الشغلانة
            </p>
          </div>
        )}
      </div>

      {/* ── 6. Section 5: Financial Summary & Payments (الحسابات والإجمالي وحالة الدفع) ── */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
        <div className="border-b border-border/50 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
              5
            </span>
            <h2 className="text-base font-bold text-foreground">
              الحسابات والإجمالي وحالة الدفع (Financial Summary & Payments)
            </h2>
          </div>

          {/* Payment Status Badge */}
          <div>
            {paymentStatus === "PAID" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>مدفوع بالكامل (Fully Paid)</span>
              </span>
            )}
            {paymentStatus === "PARTIAL" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                <span>مدفوع جزئياً (Partially Paid)</span>
              </span>
            )}
            {paymentStatus === "UNPAID" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/25 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>غير مدفوع (Unpaid)</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Controls: Discount, Tax, Paid */}
          <div className="space-y-4 rounded-2xl border border-border/70 bg-background/50 p-5">
            {/* Production subtotal */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <span className="text-xs font-bold text-muted-foreground">
                إجمالي الإنتاج قبل الخصم (Subtotal)
              </span>
              <span className="text-base font-black text-foreground font-mono">
                {subtotal.toFixed(2)} ج.م
              </span>
            </div>

            {/* Discount */}
            <div className="grid grid-cols-3 gap-2 items-center">
              <div>
                <label htmlFor={`discount-type-${generatedId}`} className="block text-2xs font-bold text-muted-foreground mb-1">
                  نوع الخصم
                </label>
                <select
                  id={`discount-type-${generatedId}`}
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "FIXED" | "PERCENT")}
                  className="w-full rounded-xl border border-border/80 bg-card px-2.5 py-2 text-xs font-bold text-foreground focus:outline-none"
                >
                  <option value="FIXED">مبلغ (EGP)</option>
                  <option value="PERCENT">نسبة (%)</option>
                </select>
              </div>

              <div>
                <label htmlFor={`discount-value-${generatedId}`} className="block text-2xs font-bold text-muted-foreground mb-1">
                  قيمة الخصم
                </label>
                <input
                  id={`discount-value-${generatedId}`}
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:outline-none"
                />
              </div>

              <div className="text-end pt-3">
                <span className="text-2xs font-bold text-muted-foreground block">
                  قيمة الخصم:
                </span>
                <span className="text-xs font-black text-rose-600 dark:text-rose-400 font-mono">
                  - {calculatedDiscount.toFixed(2)} ج.م
                </span>
              </div>
            </div>

            {/* Tax */}
            <div className="grid grid-cols-3 gap-2 items-center">
              <div>
                <label htmlFor={`tax-type-${generatedId}`} className="block text-2xs font-bold text-muted-foreground mb-1">
                  نوع الضريبة
                </label>
                <select
                  id={`tax-type-${generatedId}`}
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value as "PERCENT" | "FIXED")}
                  className="w-full rounded-xl border border-border/80 bg-card px-2.5 py-2 text-xs font-bold text-foreground focus:outline-none"
                >
                  <option value="PERCENT">نسبة (%)</option>
                  <option value="FIXED">مبلغ (EGP)</option>
                </select>
              </div>

              <div>
                <label htmlFor={`tax-value-${generatedId}`} className="block text-2xs font-bold text-muted-foreground mb-1">
                  قيمة الضريبة
                </label>
                <input
                  id={`tax-value-${generatedId}`}
                  type="number"
                  min="0"
                  value={taxValue}
                  onChange={(e) => setTaxValue(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:outline-none"
                />
              </div>

              <div className="text-end pt-3">
                <span className="text-2xs font-bold text-muted-foreground block">
                  قيمة الضريبة:
                </span>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">
                  + {calculatedTax.toFixed(2)} ج.م
                </span>
              </div>
            </div>

            <p className="text-3xs leading-relaxed text-muted-foreground">
              الخصم والضريبة يُحفظان على الأمر. الضريبة تُحسب على المبلغ بعد
              الخصم، والإجمالي = الإجمالي قبل الخصم − الخصم + الضريبة.
            </p>

            {/* Paid Amount */}
            <div className="pt-2 border-t border-border/40">
              <label htmlFor={`paid-amount-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                المدفوع نقداً / مقدم (Paid Amount ج.م)
              </label>
              <input
                id={`paid-amount-${generatedId}`}
                type="number"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                placeholder="5000"
                className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2 text-sm font-mono font-bold text-foreground focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-3xs text-muted-foreground">
                يُسجَّل كدفعة فعلية على الأمر عند الحفظ.
              </p>
            </div>
          </div>

          {/* Bento Result Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>الإجمالي قبل الخصم:</span>
                <span className="font-mono font-bold text-foreground">
                  {subtotal.toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                <span>الخصم المطبق:</span>
                <span className="font-mono font-bold">
                  - {calculatedDiscount.toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                <span>ضريبة القيمة المضافة:</span>
                <span className="font-mono font-bold">
                  + {calculatedTax.toFixed(2)} ج.م
                </span>
              </div>

              <div className="my-2 h-px w-full bg-border/60" />

              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">
                  الإجمالي النهائي (Grand Total):
                </span>
                <span className="text-2xl font-black text-foreground font-mono">
                  {grandTotal.toFixed(2)} ج.م
                </span>
              </div>
              <p className="text-3xs text-muted-foreground">
                كل شغلانة تُثبَّت بمقاس الإنتاج والطباعة والتشطيب، ويعتمد المحاسب
                الإجمالي قبل الإنتاج.
              </p>
            </div>

            <div className="mt-6 rounded-xl bg-card border border-border/70 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">المدفوع:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {paidAmount.toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">المتبقي (Remaining Balance):</span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono">
                  {remainingBalance.toFixed(2)} ج.م
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelect={(cust) => setSelectedCustomer(cust)}
        customers={customers}
        cashCustomer={cashCustomer}
        onQuickCreateCustomer={quickCreateCustomerAction}
      />

      <BannerJobModal
        isOpen={isBannerModalOpen}
        onClose={() => setIsBannerModalOpen(false)}
        onSave={handleSaveBannerJob}
        departments={departments}
        productTypes={productTypes}
        governance={governance}
        finishingServices={finishingServices}
      />

      {genericModalCategory && (
        <GenericJobModal
          isOpen={!!genericModalCategory}
          category={genericModalCategory}
          onClose={() => setGenericModalCategory(null)}
          onSave={handleSaveGenericJob}
          departments={departments}
          productTypes={productTypes}
        />
      )}
    </div>
  );
}
