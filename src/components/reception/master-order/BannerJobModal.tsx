"use client";

// BannerJobModal — reception's roll-job specification entry (093 FR-001…FR-010).
//
// WHAT THIS FILE IS NOT
// ---------------------
// It is not a second implementation of the pricing rules. There is no ladder
// literal in this file, no `if (width > 150)`, and no hand-rolled area maths.
// It calls the SAME functions `setProductionSpec` calls on submit:
//
//   resolveProductionWidth   — the one width round-up (FR-002/FR-003)
//   assertHeightWithinCap    — the height ceiling   (FR-004)
//   assertRateWithinBand     — the EGP/m² band      (FR-007)
//   deriveProductionSpec     — validation order + all the money maths (FR-006/FR-008)
//
// If a rule moves, this form moves with it because it has no copy of the rule.
//
// CANONICAL UNITS (FR-005)
// ------------------------
// Width in centimetres, height in METRES, area in m², money in EGP. There is
// deliberately no "measurement unit" toggle any more: a width toggle is how a
// 145 cm request quietly becomes 1.45 and then gets rounded up to a 150 cm
// roll for the wrong reason. Height is not one of the fixed widths — it is
// free entry, capped at the configured ceiling (50 m for the seeded roll class).
//
// THE WIDTH IS A REQUEST, NOT A DECISION
// --------------------------------------
// `customerWidthCm` is what the customer asked for and is never overwritten.
// `productionWidthCm` is what the roll actually consumes and is the ONLY width
// that feeds area. A 330 cm request is REFUSED here, never clamped to 320 — the
// receptionist is told to raise a width exception, because a clamp silently
// bills and prints a smaller banner than the customer paid for.

import React, { useMemo, useState, useId } from "react";
import {
  X,
  Plus,
  Layers,
  FileCheck2,
  Ruler,
  Check,
  Paperclip,
  HardHat,
  Eye,
  TriangleAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type {
  BannerJobSpec,
  ClientDepartment,
  ClientProductType,
  FinishingServiceOption,
  ProductionGovernance,
} from "./types";
import { parseDecimalField } from "~/lib/production/decimal";
import {
  deriveProductionSpec,
  type DeriveConstraints,
  type DerivedSnapshot,
} from "~/lib/production/derive";
import { DomainProductionSpecError, type ProductionSpecErrorCode } from "~/lib/production/errors";
import type { FinishingRate } from "~/lib/production/quote";
import { assertWidthLadder, resolveProductionWidth } from "~/lib/production/widths";

export interface BannerJobModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (spec: BannerJobSpec) => void;
  readonly initialSpec?: BannerJobSpec | null;
  readonly departments: readonly ClientDepartment[];
  readonly productTypes: readonly ClientProductType[];
  /** 093 configuration per product type — never hard-coded here. */
  readonly governance: Readonly<Record<string, ProductionGovernance>>;
  /** The extensible finishing catalogue (Sulfan is a ROW, not a branch). */
  readonly finishingServices: readonly FinishingServiceOption[];
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

/** A live quote, or the refusal standing in its place. Both are first-class. */
type LiveQuote =
  | { readonly ok: true; readonly quote: DerivedSnapshot }
  | { readonly ok: false; readonly code: ProductionSpecErrorCode; readonly message: string };

const ARABIC_REJECTIONS: Readonly<Record<string, string>> = {
  WIDTH_ABOVE_MAXIMUM: "العرض أكبر من أقصى عرض رول متاح — يُرفع استثناء للمدير، ولا يُصغَّر تلقائياً.",
  HEIGHT_ABOVE_MAXIMUM: "الطول أكبر من الحد الأقصى المسموح به لهذا المنتج.",
  RATE_OUT_OF_BAND: "سعر المتر المربع خارج النطاق المسموح به.",
  INVALID_DIMENSIONS: "أدخل العرض والطول بأرقام صحيحة أكبر من صفر.",
  FINISHING_UNAVAILABLE: "إحدى خدمات التشطيب المختارة غير متاحة.",
  INVALID_WIDTH_LADDER: "إعداد عروض الرول غير صحيح — راجع مدير النظام.",
  NOT_PRODUCTION_SPEC_GOVERNED: "نوع المنتج غير مُهيأ لتسعير المتر المربع — راجع مدير النظام.",
};

export function BannerJobModal({
  isOpen,
  onClose,
  onSave,
  initialSpec,
  departments,
  productTypes,
  governance,
  finishingServices,
}: BannerJobModalProps) {
  const generatedId = useId();

  // ── Basic ────────────────────────────────────────────────────────────────
  const [jobName, setJobName] = useState(
    initialSpec?.jobName ?? "يافطة فليكس إضاءة واجهة",
  );
  const [quantity, setQuantity] = useState<number>(initialSpec?.quantity ?? 1);
  const [unit, setUnit] = useState<"PIECES" | "SQM">(initialSpec?.unit ?? "PIECES");
  const [notes, setNotes] = useState(initialSpec?.notes ?? "");

  // ── Type & Application ───────────────────────────────────────────────────
  const [printType, setPrintType] = useState(
    initialSpec?.printType ?? "بنر عادي (Banner)",
  );
  const [materialWeight, setMaterialWeight] = useState(
    initialSpec?.materialWeight ?? "فليكس كوري 510g (Flex)",
  );
  const [materialsDispensed, setMaterialsDispensed] = useState<string[]>(
    initialSpec ? [...initialSpec.materialsDispensed] : [],
  );
  const [newMaterialInput, setNewMaterialInput] = useState("");
  const [placement, setPlacement] = useState(
    initialSpec?.placement ?? "واجهة محل (Shop Sign)",
  );

  // ── Dimensions: STRINGS, so a half-typed value is not coerced to 0 ────────
  const [customerWidthCm, setCustomerWidthCm] = useState(
    initialSpec ? String(initialSpec.customerWidthCm) : "",
  );
  const [heightCm, setHeightCm] = useState(initialSpec ? String(initialSpec.heightCm) : "");
  const [baseRatePerSqm, setBaseRatePerSqm] = useState(
    initialSpec ? String(initialSpec.baseRatePerSqm) : "",
  );
  const [finishingCodes, setFinishingCodes] = useState<string[]>(
    initialSpec ? [...initialSpec.finishingCodes] : [],
  );

  // ── Other ────────────────────────────────────────────────────────────────
  const [fieldInstallation, setFieldInstallation] = useState<boolean>(
    initialSpec?.fieldInstallation ?? false,
  );
  const [attachedFiles, setAttachedFiles] = useState<string[]>(
    initialSpec ? [...initialSpec.attachedFiles] : [],
  );
  const [artworkStatus, setArtworkStatus] = useState<"RECEIVED" | "READY_TO_PRINT">(
    initialSpec?.artworkStatus ?? "RECEIVED",
  );

  // ── Routing: which product type does this job price as? ──────────────────
  // Resolved by name here for the same reason the original form did — the
  // modal is a convenience entry point, not a routing authority. The AUTHORITY
  // is still the server: `setProductionSpec` re-reads the product type's rule
  // and re-derives, and a governed product with no rate is refused at commit.
  const bannerDept = departments.find(
    (d) =>
      d.name.toLowerCase().includes("banner") ||
      d.name.includes("بنر") ||
      d.name.includes("أوفست") ||
      d.name.toLowerCase().includes("offset"),
  );
  const bannerPt = productTypes.find(
    (pt) =>
      pt.name.toLowerCase().includes("banner") ||
      pt.name.includes("بنر") ||
      pt.name.includes("Roll-up"),
  );
  const rule = bannerPt ? governance[bannerPt.id] : undefined;

  // Parsed + validated ONCE per configuration, not per keystroke. `null` means
  // the stored configuration is unusable and that is surfaced as a refusal,
  // never quietly treated as "no rules apply here".
  const configuration = useMemo<DeriveConstraints | null>(() => {
    if (!rule) return null;
    const maxHeightM = parseDecimalField(rule.maxHeightM);
    const minRatePerSqm = parseDecimalField(rule.minRatePerSqm);
    const maxRatePerSqm = parseDecimalField(rule.maxRatePerSqm);
    if (!maxHeightM || !minRatePerSqm || !maxRatePerSqm) return null;
    try {
      return {
        ladder: assertWidthLadder(rule.ladderCm),
        maxHeightM,
        minRatePerSqm,
        maxRatePerSqm,
      };
    } catch {
      return null;
    }
  }, [rule]);

  // Opens the rate field at the configured midpoint, once. A rate the
  // receptionist typed is never overwritten — raising the price for one
  // specific order is normal business, not a mistake to be corrected.
  const [rateSeededFor, setRateSeededFor] = useState<string>(initialSpec ? "initial" : "");
  if (rateSeededFor !== rule?.productTypeId) {
    setRateSeededFor(rule?.productTypeId ?? "");
    if (!initialSpec && rule) setBaseRatePerSqm(rule.suggestedRatePerSqm);
  }

  // The width hint stands alone so an over-maximum request is called out the
  // moment it is typed, without waiting for a height and a rate. It IS the
  // production round-up, not a scan of the list written out again here.
  const widthResolution = useMemo(() => {
    if (!configuration) return null;
    const requested = parseDecimalField(customerWidthCm);
    if (!requested) return null;
    return resolveProductionWidth(requested, configuration.ladder);
  }, [configuration, customerWidthCm]);

  const live = useMemo<LiveQuote | null>(() => {
    if (!rule) return null;

    if (!configuration) {
      return {
        ok: false,
        code: "INVALID_WIDTH_LADDER",
        message: "The production width configuration for this product type is unusable",
      };
    }

    const width = parseDecimalField(customerWidthCm);
    const height = parseDecimalField(heightCm);
    const rate = parseDecimalField(baseRatePerSqm);
    if (!width || !height || !rate) return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return null;

    // Mirrors `resolveFinishingRates`: a selected code that is not in the
    // catalogue is a refusal, never a silent skip. "The customer paid for
    // Sulfan and we quietly dropped it" is the bug this whole feature exists to
    // prevent, and the browser must not be more forgiving than the server.
    const finishingRates: FinishingRate[] = [];
    for (const code of finishingCodes) {
      const service = finishingServices.find((f) => f.code === code);
      const serviceRate = service ? parseDecimalField(service.ratePerSqm) : null;
      if (!service || !serviceRate) {
        return {
          ok: false,
          code: "FINISHING_UNAVAILABLE",
          message: `Finishing "${code}" is not available for pricing`,
        };
      }
      finishingRates.push({
        finishingServiceId: service.id,
        code: service.code,
        labelAr: service.labelAr,
        ratePerSqm: serviceRate,
      });
    }

    try {
      const derived = deriveProductionSpec(
        {
          customerWidthCm: width,
          heightCm: height,
          quantity,
          baseRatePerSqm: rate,
          finishingRates,
          // No exception can exist yet: a ticket is raised against a work item,
          // and this job has not been saved. An over-ceiling width is refused
          // here exactly as the server refuses it on commit.
          exception: null,
        },
        configuration,
      );
      return { ok: true, quote: derived.snapshot };
    } catch (error) {
      if (error instanceof DomainProductionSpecError) {
        return { ok: false, code: error.code, message: error.message };
      }
      throw error;
    }
  }, [
    rule,
    configuration,
    customerWidthCm,
    heightCm,
    baseRatePerSqm,
    quantity,
    finishingCodes,
    finishingServices,
  ]);

  if (!isOpen) return null;

  const handleAddMaterial = () => {
    if (!newMaterialInput.trim()) return;
    setMaterialsDispensed((prev) => [...prev, newMaterialInput.trim()]);
    setNewMaterialInput("");
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterialsDispensed((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleFinishing = (code: string) => {
    setFinishingCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleAddFile = () => {
    setAttachedFiles((prev) => [...prev, `artwork_${Date.now().toString().slice(-4)}.pdf`]);
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!jobName.trim()) {
      alert("يرجى إدخال اسم الشغلانة");
      return;
    }
    if (!live?.ok) {
      alert(
        live
          ? "لا يمكن تسعير هذه الشغلانة — صحّح البيانات أولاً"
          : "أدخل العرض والطول وسعر المتر المربع لإتمام التسعير",
      );
      return;
    }

    const q = live.quote;
    const productionWidthCm = Number(q.productionWidthCm);
    const heightCm = Number(q.heightCm);

    const spec: BannerJobSpec = {
      id: initialSpec?.id ?? `banner_${Date.now()}`,
      jobName: jobName.trim(),
      quantity: quantity || 1,
      unit,
      notes: notes.trim(),
      printType,
      materialWeight,
      materialsDispensed,
      placement,
      // Both widths are stored, side by side. The customer's request is never
      // overwritten by the rounding decision (FR-001/FR-002).
      customerWidthCm: Number(q.customerWidthCm),
      productionWidthCm,
      roundedUp: q.roundedUp,
      heightCm,
      // Display-only convenience: the AUTHORITATIVE billable area (which
      // includes quantity) is `q.areaSqm`, straight from `deriveProductionSpec`.
      areaPerPieceSqm: round2((productionWidthCm / 100) * (heightCm / 100)),
      totalAreaSqm: Number(q.areaSqm),
      baseRatePerSqm: Number(q.baseRatePerSqm),
      baseTotal: Number(q.baseTotal),
      finishingCodes,
      finishingLines: q.finishings.map((f) => ({
        code: f.code,
        labelAr: f.labelAr,
        ratePerSqm: Number(f.ratePerSqm),
        amount: Number(f.amount),
      })),
      finishingTotal: Number(q.finishingTotal),
      total: Number(q.total),
      fieldInstallation,
      attachedFiles,
      artworkStatus,
      departmentId: bannerDept?.id,
      productTypeId: bannerPt?.id,
    };

    onSave(spec);
    onClose();
  };

  const canSubmit = live?.ok === true && jobName.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-white/20 bg-card shadow-2xl overflow-hidden text-foreground">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-amber-500/10 via-card to-card p-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  مواصفات شغلانة بنر وفليكس (Banner &amp; Flex Job)
                </h2>
                <span className="rounded-full bg-amber-500/15 border border-amber-500/25 px-2.5 py-0.5 text-3xs font-black text-amber-700 dark:text-amber-300">
                  شغلانة أوفست / بنر
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                عرض العميل يُقرَّب لأعلى على أقرب رول متاح، والمساحة تُحسب من عرض الإنتاج
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

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-7">
          {/* ── 1. Basic ── */}
          <div className="rounded-2xl border border-border/70 bg-background/50 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                  1
                </span>
                البيانات الأساسية لشغلانة البنر (Basic Job Information)
              </span>
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
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
                    className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none"
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
                  وصف وملاحظات الشغلانة (Job Notes &amp; Description)
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
                نوع المنتج والتطبيق (Type &amp; Application)
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
                  نوع الخامة والوزن (Material &amp; Weight)
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

          {/* ── 3. Dimensions & the roll decision ── */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-blue-500/20 pb-3">
              <span className="text-sm font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold">
                  3
                </span>
                الأبعاد وقرار الرول (Dimensions &amp; Production Roll)
              </span>
              {rule ? (
                <span className="inline-flex items-center gap-1.5 text-3xs font-mono text-muted-foreground">
                  <Ruler className="h-3.5 w-3.5" />
                  عروض الرول: {rule.ladderCm.join(" - ")} سم
                </span>
              ) : null}
            </div>

            {!rule ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-2xs text-amber-700 dark:text-amber-300">
                  نوع المنتج المرتبط بهذه الشغلانة غير مُهيأ لتسعير المتر المربع (لا يوجد عليه
                  عرض رول مُعرَّف). لن يتم تسعير الشغلانة — راجع مدير النظام لتفعيل المنتج.
                </span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Customer width — a REQUEST. Centimetres, always. */}
                  <div>
                    <label htmlFor={`width-input-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                      عرض العميل (Customer Width — سم)*
                    </label>
                    <div className="relative">
                      <input
                        id={`width-input-${generatedId}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={customerWidthCm}
                        onChange={(e) => setCustomerWidthCm(e.target.value)}
                        placeholder="145"
                        aria-describedby={`width-hint-${generatedId}`}
                        className={`w-full rounded-xl border bg-card px-3.5 py-2 ps-20 text-sm font-mono text-foreground focus:outline-none ${
                          widthResolution?.ok === false
                            ? "border-destructive/70 focus:border-destructive"
                            : "border-border/80 focus:border-blue-500"
                        }`}
                        required
                      />
                      <span className="absolute start-3 top-2.5 text-xs text-muted-foreground">
                        سم (cm)
                      </span>
                    </div>
                  </div>

                  {/* Height — free entry in CENTIMETRES, same unit as the width.
                      Height is NOT one of the fixed widths. */}
                  <div>
                    <label htmlFor={`height-input-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                      الطول (Height — سم)*
                    </label>
                    <div className="relative">
                      <input
                        id={`height-input-${generatedId}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        placeholder="200"
                        className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2 ps-20 text-sm font-mono text-foreground focus:border-blue-500 focus:outline-none"
                        required
                      />
                      <span className="absolute start-3 top-2.5 text-xs text-muted-foreground">
                        سم (cm)
                      </span>
                    </div>
                    <p className="mt-1 text-3xs text-muted-foreground">
                      الحد الأقصى: {rule.maxHeightM} متر ({Number(rule.maxHeightM) * 100} سم)
                    </p>
                  </div>
                </div>

                {/* The roll decision, stated out loud. */}
                <div id={`width-hint-${generatedId}`} className="space-y-2">
                  {widthResolution?.ok === false && (
                    <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-2xs text-destructive">
                      <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                      <span>
                        العرض المطلوب ({widthResolution.customerWidthCm} سم) أكبر من أقصى عرض رول
                        متاح ({widthResolution.maxWidthCm} سم). لن يتم تصغيره تلقائياً — يجب رفع
                        استثناء عرض واعتماده من المدير أولاً.
                      </span>
                    </p>
                  )}

                  {widthResolution?.ok === true && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-500/30 bg-card px-3 py-2 text-2xs">
                      <Ruler className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-muted-foreground">عرض العميل (مطلوب):</span>
                      <span className="font-mono font-bold text-foreground">
                        {widthResolution.customerWidthCm} سم
                      </span>
                      <span className="text-muted-foreground">← عرض التسعير (roll):</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {widthResolution.productionWidthCm} سم
                      </span>
                      {widthResolution.rounded ? (
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-bold text-amber-700 dark:text-amber-300">
                          مقرَّب لأعلى (+{widthResolution.roundingDeltaCm} سم)
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                          مطابق لعرض رول موجود
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── 4. Pricing + extensible finishings ── */}
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <span className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold">
                  4
                </span>
                التسعير وخدمات التشطيب (Pricing &amp; Additional Services)
              </span>
              <span className="text-xs text-muted-foreground">
                الاستقبال يختار السعر — النظام يحسب الإجمالي
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`rate-per-sqm-${generatedId}`} className="block text-xs font-bold text-foreground mb-1.5">
                  سعر المتر المربع (ج.م / م²)*
                </label>
                <input
                  id={`rate-per-sqm-${generatedId}`}
                  type="number"
                  min="0"
                  step="0.5"
                  value={baseRatePerSqm}
                  onChange={(e) => setBaseRatePerSqm(e.target.value)}
                  placeholder={rule?.suggestedRatePerSqm ?? "100"}
                  className={`w-full rounded-xl border bg-card px-3.5 py-2 text-sm font-mono font-bold text-foreground focus:outline-none ${
                    live && !live.ok && live.code === "RATE_OUT_OF_BAND"
                      ? "border-destructive/70 focus:border-destructive"
                      : "border-border/80 focus:border-amber-500"
                  }`}
                  required
                />
                {rule ? (
                  <p className="mt-1 text-3xs text-muted-foreground">
                    النطاق المسموح: {rule.minRatePerSqm} – {rule.maxRatePerSqm} ج.م/م²
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                خدمات إضافية (تُحسب على نفس المساحة)
              </span>
              {finishingServices.length === 0 ? (
                <p className="text-3xs text-muted-foreground">لا توجد خدمات تشطيب مُعرَّفة بعد.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {finishingServices.map((service) => {
                    const selected = finishingCodes.includes(service.code);
                    return (
                      <button
                        key={service.code}
                        type="button"
                        onClick={() => toggleFinishing(service.code)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-start text-xs transition-all ${
                          selected
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                            : "border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40 bg-background"
                          }`}
                        >
                          {selected ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                        </span>
                        <span className="flex-1 truncate">{service.labelAr}</span>
                        <span className="font-mono text-3xs text-muted-foreground">
                          {service.ratePerSqm} ج.م/م²
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <PricePanel live={live} rule={rule} />
          </div>

          {/* ── 5. Field installation & artwork ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          {/* ── 7. Live order summary ── */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-inner space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Eye className="h-4 w-4 text-primary" />
              <span>ملخص الشغلانة النهائي كما يظهر بالنظام (Live Order Summary):</span>
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
                <span className="text-3xs text-muted-foreground block">العرض (عميل ← إنتاج)</span>
                <span className="font-bold text-foreground font-mono block">
                  {customerWidthCm || "—"} ← {live?.ok ? live.quote.productionWidthCm : "—"} سم
                </span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2.5">
                <span className="text-3xs text-muted-foreground block">المساحة المحتسبة</span>
                <span className="font-bold text-foreground font-mono block">
                  {live?.ok ? `${live.quote.areaSqm} م²` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-border/70 bg-muted/40 p-4 sm:px-8">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
            إلغاء
          </Button>

          <Button
            type="button"
            variant="default"
            onClick={handleSave}
            disabled={!canSubmit}
            className="rounded-xl bg-amber-600 hover:bg-amber-500 font-bold px-6 shadow-md shadow-amber-500/25 disabled:opacity-50"
          >
            <Check className="h-4 w-4 me-1.5" />
            <span>إضافة الشغلانة إلى أمر الطباعة</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The three-way breakdown the spec requires the receptionist to be able to see
 * before submitting: the customer dimensions, the production dimensions, and
 * the calculated production area with its money.
 */
function PricePanel({
  live,
  rule,
}: {
  live: LiveQuote | null;
  rule: ProductionGovernance | undefined;
}) {
  if (!rule) return null;

  if (live && !live.ok) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-destructive">لا يمكن التسعير</span>
          <span className="text-2xs text-destructive/90">
            {ARABIC_REJECTIONS[live.code] ?? live.message}
          </span>
        </div>
      </div>
    );
  }

  if (!live?.ok) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-2xs text-muted-foreground">
        <span>أدخل عرض العميل والطول وسعر المتر المربع لعرض السعر المحسوب تلقائياً.</span>
      </div>
    );
  }

  const q = live.quote;

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-card to-card p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-2xs sm:grid-cols-3">
        <Line label="أبعاد العميل" value={`${q.customerWidthCm} × ${q.heightCm} سم`} />
        <Line
          label="أبعاد التسعير"
          value={`${q.productionWidthCm} × ${q.heightCm} سم`}
          strong
        />
        <Line label="المساحة المحتسبة" value={`${q.areaSqm} م²`} strong />
        <Line label="الكمية" value={String(q.quantity)} />
        <Line label="سعر المتر المربع" value={`${q.baseRatePerSqm} ج.م`} />
        <Line label="قيمة الطباعة" value={`${q.baseTotal} ج.م`} />
      </dl>

      {q.finishings.length > 0 && (
        <ul className="space-y-1 border-t border-amber-500/20 pt-2.5 text-2xs">
          {q.finishings.map((f) => (
            <li key={f.finishingServiceId} className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {f.labelAr} <span className="font-mono">({f.ratePerSqm} ج.م/م²)</span>
              </span>
              <span className="font-mono">{f.amount} ج.م</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-baseline justify-between border-t border-amber-500/20 pt-2.5">
        <span className="text-xs font-bold text-foreground">الإجمالي النهائي للشغلانة</span>
        <span className="font-mono text-xl font-black text-amber-600 dark:text-amber-400">
          {q.total} ج.م
        </span>
      </div>
      <p className="text-3xs text-muted-foreground">
        الإجمالي = الطباعة {q.baseTotal} ج.م + التشطيب {q.finishingTotal} ج.م — محسوب بالنظام
      </p>
    </div>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-mono font-bold text-foreground" : "font-mono text-foreground"}>
        {value}
      </dd>
    </div>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}