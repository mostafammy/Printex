"use client";

import React, { useState, useId } from "react";
import {
  X,
  Plus,
  Layers,
  FileCheck2,
  Calculator,
  Tag,
  Check,
  Paperclip,
  HardHat,
  Eye,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type { BannerJobSpec, ClientDepartment, ClientProductType } from "./types";

export interface BannerJobModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (spec: BannerJobSpec) => void;
  readonly initialSpec?: BannerJobSpec | null;
  readonly defaultRatePerSqm?: number;
  readonly departments: readonly ClientDepartment[];
  readonly productTypes: readonly ClientProductType[];
}

const PRINT_TYPES = [
  "بنر عادي (Banner)",
  "فليكس (Flex)",
  "استيكر فينيل (Sticker)",
  "ميش شبكي (Mesh)",
  "بنر مصمت معتم (Blockout)",
  "قماش كانفاس (Canvas)",
  "استيكر وان واي (One Way Vision)",
];

const MATERIAL_OPTIONS = [
  "فليكس كوري 510g (Flex)",
  "بنر 440g صيني اقتصادي",
  "بنر 510g كوري عالي الجودة",
  "استيكر فينيل ألماني 100 ميكرون",
  "فليكس معتم عالي التحمل 550g",
  "ميش شبكي خارجي مقاوم للرياح",
];

const PLACEMENT_OPTIONS = [
  "خارجي أوت دور (Outdoor)",
  "داخلي إن دور (Indoor)",
  "سيارات ومركبات (Vehicle Wrap)",
  "واجهة محل (Shop Sign)",
  "مبنى / واجهة جدارية (Building)",
  "معارض ومؤتمرات (Event / Exhibition)",
  "حملات إعلانية (Advertising)",
  "تطبيق آخر (Other)",
];

const FINISHING_OPTIONS = [
  { id: "cutting", label: "قص عادي (Cutting)" },
  { id: "hem", label: "ثني ولحام الحواف (Hem)" },
  { id: "eyelets", label: "تركيب حلقات كبس (Eyelets)" },
  { id: "rope", label: "حبل شد (Rope)" },
  { id: "welding", label: "لحام وتوصيل وصلات (Welding)" },
  { id: "pole_pocket", label: "جيب ماسورة (Pole Pocket)" },
  { id: "cold_lam", label: "سلوفان بارد (Cold Lamination)" },
  { id: "hot_lam", label: "سلوفان حراري (Hot Lamination)" },
  { id: "trimming", label: "تفريغ وفرز (Trimming)" },
  { id: "shape_cutting", label: "قص فورمة وشكل (Shape Cutting)" },
  { id: "other_finish", label: "تشطيب آخر (Other Finishing)" },
];

export function BannerJobModal({
  isOpen,
  onClose,
  onSave,
  initialSpec,
  defaultRatePerSqm = 100,
  departments,
  productTypes,
}: BannerJobModalProps) {
  const generatedId = useId();
  // Basic
  const [pricingMode, setPricingMode] = useState<"CALCULATOR" | "DIRECT">(
    initialSpec?.pricingMode ?? "CALCULATOR"
  );
  const [jobName, setJobName] = useState(
    initialSpec?.jobName ?? "يافطة فليكس إضاءة واجهة"
  );
  const [quantity, setQuantity] = useState<number>(initialSpec?.quantity ?? 1);
  const [unit, setUnit] = useState<"PIECES" | "SQM">(initialSpec?.unit ?? "PIECES");
  const [notes, setNotes] = useState(initialSpec?.notes ?? "");

  // Type & Application
  const [printType, setPrintType] = useState(
    initialSpec?.printType ?? "بنر عادي (Banner)"
  );
  const [materialWeight, setMaterialWeight] = useState(
    initialSpec?.materialWeight ?? "فليكس كوري 510g (Flex)"
  );
  const [materialsDispensed, setMaterialsDispensed] = useState<string[]>(
    initialSpec ? [...initialSpec.materialsDispensed] : []
  );
  const [newMaterialInput, setNewMaterialInput] = useState("");
  const [placement, setPlacement] = useState(
    initialSpec?.placement ?? "واجهة محل (Shop Sign)"
  );

  // Dimensions
  const [width, setWidth] = useState<number>(initialSpec?.width ?? 3);
  const [height, setHeight] = useState<number>(initialSpec?.height ?? 1.5);
  const [measurementUnit, setMeasurementUnit] = useState<"M" | "CM">(
    initialSpec?.measurementUnit ?? "M"
  );

  // Finishing
  const [finishingOptions, setFinishingOptions] = useState<string[]>(
    initialSpec ? [...initialSpec.finishingOptions] : ["قص عادي (Cutting)", "ثني ولحام الحواف (Hem)"]
  );

  // Field Installation
  const [fieldInstallation, setFieldInstallation] = useState<boolean>(
    initialSpec?.fieldInstallation ?? false
  );

  // Artwork & Files
  const [attachedFiles, setAttachedFiles] = useState<string[]>(
    initialSpec ? [...initialSpec.attachedFiles] : []
  );
  const [artworkStatus, setArtworkStatus] = useState<"RECEIVED" | "READY_TO_PRINT">(
    initialSpec?.artworkStatus ?? "READY_TO_PRINT"
  );

  // Pricing
  const [pricingMethod, setPricingMethod] = useState<"PER_SQM" | "PER_PIECE">(
    initialSpec?.pricingMethod ?? "PER_SQM"
  );
  const [ratePerUnit, setRatePerUnit] = useState<number>(
    initialSpec?.ratePerUnit ?? defaultRatePerSqm
  );
  const [discount, setDiscount] = useState<number>(initialSpec?.discount ?? 0);
  const [applyTax, setApplyTax] = useState<boolean>(true);

  if (!isOpen) return null;

  // Area calculation
  const widthInMeters = measurementUnit === "CM" ? width / 100 : width;
  const heightInMeters = measurementUnit === "CM" ? height / 100 : height;
  const singlePieceArea = Math.round(widthInMeters * heightInMeters * 100) / 100;
  const totalArea = Math.round(singlePieceArea * (quantity || 1) * 100) / 100;

  // Calculation
  let baseAmount = 0;
  if (pricingMode === "CALCULATOR") {
    if (pricingMethod === "PER_SQM") {
      baseAmount = totalArea * (ratePerUnit || 0);
    } else {
      baseAmount = (quantity || 1) * (ratePerUnit || 0);
    }
  } else {
    baseAmount = (ratePerUnit || 0);
  }

  const discounted = Math.max(0, baseAmount - (discount || 0));
  const taxAmount = applyTax ? discounted * 0.14 : 0;
  const totalCost = Math.round((discounted + taxAmount) * 100) / 100;

  const handleAddMaterial = () => {
    if (!newMaterialInput.trim()) return;
    setMaterialsDispensed((prev) => [...prev, newMaterialInput.trim()]);
    setNewMaterialInput("");
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterialsDispensed((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleFinishing = (label: string) => {
    setFinishingOptions((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const handleAddFile = () => {
    const fileName = `artwork_${Date.now().toString().slice(-4)}.pdf`;
    setAttachedFiles((prev) => [...prev, fileName]);
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!jobName.trim()) {
      alert("يرجى إدخال اسم الشغلانة");
      return;
    }

    // Resolve matching banner department and product type
    const bannerDept = departments.find(
      (d) =>
        d.name.toLowerCase().includes("banner") ||
        d.name.includes("بنر") ||
        d.name.includes("أوفست") ||
        d.name.toLowerCase().includes("offset")
    );
    const bannerPt = productTypes.find(
      (pt) =>
        pt.name.toLowerCase().includes("banner") ||
        pt.name.includes("بنر") ||
        pt.name.includes("Roll-up")
    );

    const spec: BannerJobSpec = {
      id: initialSpec?.id ?? `banner_${Date.now()}`,
      pricingMode,
      jobName: jobName.trim(),
      quantity: quantity || 1,
      unit,
      notes: notes.trim(),
      printType,
      materialWeight,
      materialsDispensed,
      placement,
      width,
      height,
      measurementUnit,
      singlePieceArea,
      totalArea,
      finishingOptions,
      fieldInstallation,
      attachedFiles,
      artworkStatus,
      pricingMethod,
      ratePerUnit,
      discount,
      taxRate: applyTax ? 14 : 0,
      totalCost,
      departmentId: bannerDept?.id,
      productTypeId: bannerPt?.id,
    };

    onSave(spec);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-white/20 bg-card shadow-2xl overflow-hidden text-foreground">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-amber-500/10 via-card to-card p-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  مواصفات شغلانة بنر وفليكس (Banner & Flex Job)
                </h2>
                <span className="rounded-full bg-amber-500/15 border border-amber-500/25 px-2.5 py-0.5 text-3xs font-black text-amber-700 dark:text-amber-300">
                  شغلانة أوفست / بنر
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                تحديد الأبعاد، حساب المساحة الفورية، التشطيبات والتسعير بنظام تسعير المطبعة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-7">
          {/* ── 1. Basic Job Information ── */}
          <div className="rounded-2xl border border-border/70 bg-background/50 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                  1
                </span>
                البيانات الأساسية لشغلانة البنر (Basic Job Information)
              </span>

              {/* Pricing Mode Toggle */}
              <div className="flex items-center rounded-xl bg-muted p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPricingMode("CALCULATOR")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                    pricingMode === "CALCULATOR"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calculator className="h-3.5 w-3.5" />
                  <span>استخدام الحاسبة (Calculator Mode)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPricingMode("DIRECT")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                    pricingMode === "DIRECT"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span>إدخال السعر مباشرة (Direct Price)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor={`job-name-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  اسم الشغلانة (Job Name)*
                </label>
                <input
                  id={`job-name-${generatedId}`}
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="مثال: يافطة فليكس إضاءة واجهة"
                  className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor={`job-quantity-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  الكمية (Quantity)*
                </label>
                <div className="flex gap-2">
                  <input
                    id={`job-quantity-${generatedId}`}
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    required
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as "PIECES" | "SQM")}
                    className="rounded-xl border border-border/80 bg-card px-2.5 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="PIECES">قطع</option>
                    <option value="SQM">متر مربع</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor={`job-notes-${generatedId}`} className="block text-xs font-bold text-muted-foreground mb-1.5">
                  وصف وملاحظات الشغلانة (Job Notes & Description)
                </label>
                <textarea
                  id={`job-notes-${generatedId}`}
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي تعليمات خاصة بالطباعة، القص، أو متطلبات العميل..."
                  className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* ── 2. Type & Application ── */}
          <div className="rounded-2xl border border-border/70 bg-background/50 p-5 space-y-4">
            <div className="border-b border-border/40 pb-3">
              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                  2
                </span>
                نوع المنتج والتطبيق (Type & Application)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`print-type-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  نوع الطباعة (Print Type)
                </label>
                <select
                  id={`print-type-${generatedId}`}
                  value={printType}
                  onChange={(e) => setPrintType(e.target.value)}
                  className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                >
                  {PRINT_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`material-weight-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  نوع الخامة والوزن (Material & Weight)
                </label>
                <select
                  id={`material-weight-${generatedId}`}
                  value={materialWeight}
                  onChange={(e) => setMaterialWeight(e.target.value)}
                  className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                >
                  {MATERIAL_OPTIONS.map((mat) => (
                    <option key={mat} value={mat}>
                      {mat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`placement-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  موقع وتطبيق الاستخدام (Application / Placement)
                </label>
                <select
                  id={`placement-${generatedId}`}
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value)}
                  className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                >
                  {PLACEMENT_OPTIONS.map((pl) => (
                    <option key={pl} value={pl}>
                      {pl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`new-material-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  خامات ومستلزمات التشغيل (Material Dispensing)
                </label>
                <div className="flex gap-2">
                  <input
                    id={`new-material-${generatedId}`}
                    type="text"
                    value={newMaterialInput}
                    onChange={(e) => setNewMaterialInput(e.target.value)}
                    placeholder="مثال: شاسيه حديد، إضاءة ليد..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMaterial();
                      }
                    }}
                    className="flex-1 rounded-xl border border-border/80 bg-card px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddMaterial}
                    className="shrink-0 rounded-xl gap-1 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>إضافة خامة</span>
                  </Button>
                </div>

                {materialsDispensed.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {materialsDispensed.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs text-primary font-medium"
                      >
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(idx)}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 3. Dimensions & Area Engine ── */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-blue-500/20 pb-3">
              <span className="text-sm font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold">
                  3
                </span>
                الأبعاد وحاسبة المساحة الفورية (Dimensions & Area Engine)
              </span>

              <div className="flex items-center rounded-xl bg-blue-500/10 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMeasurementUnit("M")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    measurementUnit === "M"
                      ? "bg-card text-blue-600 dark:text-blue-400 shadow-2xs"
                      : "text-muted-foreground"
                  }`}
                >
                  متر (Meter)
                </button>
                <button
                  type="button"
                  onClick={() => setMeasurementUnit("CM")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    measurementUnit === "CM"
                      ? "bg-card text-blue-600 dark:text-blue-400 shadow-2xs"
                      : "text-muted-foreground"
                  }`}
                >
                  سم (CM)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 items-center">
              <div>
                <label htmlFor={`width-input-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  العرض Width (W)*
                </label>
                <div className="relative">
                  <input
                    id={`width-input-${generatedId}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2 text-sm font-mono text-foreground focus:border-blue-500 focus:outline-none"
                    required
                  />
                  <span className="absolute end-3 top-2.5 text-xs text-muted-foreground">
                    {measurementUnit === "M" ? "متر" : "سم"}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor={`height-input-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  الارتفاع Height (H)*
                </label>
                <div className="relative">
                  <input
                    id={`height-input-${generatedId}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2 text-sm font-mono text-foreground focus:border-blue-500 focus:outline-none"
                    required
                  />
                  <span className="absolute end-3 top-2.5 text-xs text-muted-foreground">
                    {measurementUnit === "M" ? "متر" : "سم"}
                  </span>
                </div>
              </div>

              {/* Calculated Single Piece Area */}
              <div className="rounded-xl border border-blue-500/30 bg-card p-3 text-center">
                <span className="text-3xs font-bold text-muted-foreground block mb-0.5">
                  مساحة القطعة الواحدة
                </span>
                <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                  {singlePieceArea.toFixed(2)} م²
                </span>
              </div>

              {/* Calculated Total Area */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                <span className="text-3xs font-bold text-muted-foreground block mb-0.5">
                  إجمالي المساحة لكافة القطع
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {totalArea.toFixed(2)} م²
                </span>
              </div>
            </div>
          </div>

          {/* ── 4. Finishing & Accessories ── */}
          <div className="rounded-2xl border border-border/70 bg-background/50 p-5 space-y-3">
            <div className="border-b border-border/40 pb-3">
              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                  4
                </span>
                التجهيزات والحلقات واللحام (Finishing & Accessories)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {FINISHING_OPTIONS.map((opt) => {
                const isSelected = finishingOptions.includes(opt.label);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleFinishing(opt.label)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-start text-xs transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                        : "border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    >
                      {isSelected ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 5. Field Installation & 6. Artwork File Review ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 5. Field Installation */}
            <div className="rounded-2xl border border-border/70 bg-background/50 p-5 space-y-3">
              <div className="border-b border-border/40 pb-2">
                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                    5
                  </span>
                  التركيب الميداني والشاسيهات
                </span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2.5">
                  <HardHat className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      تفعيل خدمة التركيب الميداني
                    </span>
                    <span className="text-3xs text-muted-foreground">
                      إرسال فني تركيب وشاسيه لموقع العميل
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={fieldInstallation}
                    onChange={(e) => setFieldInstallation(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-muted peer-checked:bg-primary peer-focus:outline-none transition-colors after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full" />
                </label>
              </div>
            </div>

            {/* 6. Artwork & File Review */}
            <div className="rounded-2xl border border-border/70 bg-background/50 p-5 space-y-3">
              <div className="border-b border-border/40 pb-2">
                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                    6
                  </span>
                  ملفات التصميم وحالة المراجعة
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">
                      حالة اعتماد التصميم:
                    </span>
                    <select
                      value={artworkStatus}
                      onChange={(e) =>
                        setArtworkStatus(e.target.value as "RECEIVED" | "READY_TO_PRINT")
                      }
                      className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-bold text-foreground"
                    >
                      <option value="RECEIVED">تم الاستلام (Received)</option>
                      <option value="READY_TO_PRINT">جاهز للطباعة (Ready to Print)</option>
                    </select>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddFile}
                    className="h-8 gap-1 rounded-xl text-xs"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                    <span>+ إضافة ملف</span>
                  </Button>
                </div>

                {attachedFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {attachedFiles.map((file, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-3xs font-mono text-foreground"
                      >
                        <FileCheck2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>{file}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-3xs text-muted-foreground">لم يتم إرفاق ملفات بعد</p>
                )}
              </div>
            </div>
          </div>

          {/* ── 7. Pricing & Totals ── */}
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <span className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold">
                  7
                </span>
                التسعير والإجمالي النهائي (Pricing & Totals)
              </span>

              <span className="text-xs font-semibold text-muted-foreground">
                تسعير فوري متصل بنظام المحاسبة
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 items-center">
              <div>
                <label htmlFor={`pricing-method-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  طريقة التسعير
                </label>
                <select
                  id={`pricing-method-${generatedId}`}
                  value={pricingMethod}
                  onChange={(e) => setPricingMethod(e.target.value as "PER_SQM" | "PER_PIECE")}
                  className="w-full rounded-xl border border-border/80 bg-card px-3 py-2 text-xs font-bold text-foreground focus:border-amber-500 focus:outline-none"
                >
                  <option value="PER_SQM">بالمتر المربع (Per Sqm)</option>
                  <option value="PER_PIECE">بالقطعة (Per Piece)</option>
                </select>
              </div>

              <div>
                <label htmlFor={`rate-per-unit-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  السعر {pricingMethod === "PER_SQM" ? "لكل م²" : "للقطعة"} (ج.م)*
                </label>
                <input
                  id={`rate-per-unit-${generatedId}`}
                  type="number"
                  min="0"
                  step="0.5"
                  value={ratePerUnit}
                  onChange={(e) => setRatePerUnit(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-border/80 bg-card px-3 py-2 text-sm font-mono font-bold text-foreground focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor={`discount-input-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  الخصم (Discount ج.م)
                </label>
                <input
                  id={`discount-input-${generatedId}`}
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-border/80 bg-card px-3 py-2 text-sm font-mono text-foreground focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id={`tax-check-${generatedId}`}
                  checked={applyTax}
                  onChange={(e) => setApplyTax(e.target.checked)}
                  className="h-4 w-4 rounded-md border-border text-primary focus:ring-primary"
                />
                <label htmlFor={`tax-check-${generatedId}`} className="text-xs font-bold text-foreground cursor-pointer">
                  ضريبة القيمة المضافة (14%)
                </label>
              </div>
            </div>

            {/* Total Cost Display Box */}
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-500/20 via-card to-card p-4 border border-amber-500/30">
              <div>
                <span className="text-xs font-bold text-muted-foreground block">
                  إجمالي تكلفة الشغلانة (Total Job Cost):
                </span>
                <span className="text-2xs text-muted-foreground">
                  {totalArea} م² × {ratePerUnit} ج.م
                  {discount > 0 ? ` - ${discount} خصم` : ""}
                  {applyTax ? ` + ${taxAmount.toFixed(1)} ضريبة` : ""}
                </span>
              </div>
              <div className="text-end">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {totalCost.toFixed(2)} ج.م
                </span>
              </div>
            </div>
          </div>

          {/* ── 8. Live Order Summary ── */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-inner space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Eye className="h-4 w-4 text-primary" />
              <span>ملخص الشغلانة النهائي كما ظهر بالنظام (Live Order Summary):</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
              <div className="rounded-lg bg-muted/60 p-2.5">
                <span className="text-3xs text-muted-foreground block">اسم الشغلانة</span>
                <span className="font-bold text-foreground truncate block">{jobName || "بنر"}</span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2.5">
                <span className="text-3xs text-muted-foreground block">الخامة والنوع</span>
                <span className="font-bold text-foreground truncate block">
                  {printType.split(" ")[0]} - {materialWeight.split(" ")[0]}
                </span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2.5">
                <span className="text-3xs text-muted-foreground block">الأبعاد والمساحة</span>
                <span className="font-bold text-foreground font-mono block">
                  {width}m × {height}m ({totalArea} م² إجمالي)
                </span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2.5">
                <span className="text-3xs text-muted-foreground block">حالة التصميم والإنتاج</span>
                <span className="font-bold text-foreground block">
                  {artworkStatus === "READY_TO_PRINT" ? "جاهز للطباعة" : "تم الاستلام"} ▪ ({attachedFiles.length} ملفات)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/70 bg-muted/40 p-4 sm:px-8">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
            إلغاء
          </Button>

          <Button
            type="button"
            variant="default"
            onClick={handleSave}
            className="rounded-xl bg-amber-600 hover:bg-amber-500 font-bold px-6 shadow-md shadow-amber-500/25"
          >
            <Check className="h-4 w-4 me-1.5" />
            <span>إضافة الشغلانة إلى أمر الطباعة</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
