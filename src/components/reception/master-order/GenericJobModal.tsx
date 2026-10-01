"use client";

import React, { useState, useId } from "react";
import { X, Check, Layers } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { JobCategory, MasterOrderItem, ClientDepartment, ClientProductType } from "./types";

export interface GenericJobModalProps {
  readonly isOpen: boolean;
  readonly category: JobCategory;
  readonly onClose: () => void;
  readonly onSave: (item: MasterOrderItem) => void;
  readonly departments: readonly ClientDepartment[];
  readonly productTypes: readonly ClientProductType[];
}

const CATEGORY_CONFIG: Record<
  JobCategory,
  {
    titleAr: string;
    badgeAr: string;
    defaultName: string;
    materials: string[];
    defaultUnit: string;
  }
> = {
  OFFSET: {
    titleAr: "شغلانة أوفست (Offset Printing)",
    badgeAr: "كميات كبيرة، علب، كتب، مجلات",
    defaultName: "بروشور / كتاب أوفست فاخر",
    materials: ["ورق كوشيه 150g", "ورق كوشيه 300g", "ورق طبع 80g", "دوبلكس رمادي", "كرافت"],
    defaultUnit: "ألف نسخة",
  },
  DIGITAL: {
    titleAr: "شغلانة طباعة ديجيتال (Digital Printing)",
    badgeAr: "طباعة فورية، كروت، فوتو، أوراق",
    defaultName: "كروت شخصية / فلاير ديجيتال",
    materials: ["كوشيه 350g مط", "كوشيه 300g لميع", "ورق فوتو 260g", "استيكر مقصوص", "برستول كويتي"],
    defaultUnit: "قطع",
  },
  SILK_SCREEN: {
    titleAr: "شغلانة سلك سكرين (Silk Screen)",
    badgeAr: "ملابس، تيشيرتات، هدايا، قماش",
    defaultName: "طباعة تيشيرتات / أكياس قماش",
    materials: ["قطن 100%", "بوليستر", "أكياس قماش غير منسوج", "جلد صناعي", "بلاستيك"],
    defaultUnit: "قطع",
  },
  BANNER_FLEX: {
    titleAr: "شغلانة بنر وفليكس (Banner & Flex)",
    badgeAr: "لافتات، أوت دور، استيكر، ميش",
    defaultName: "يافطة بنر / فليكس إضاءة",
    materials: ["فليكس كوري 510g", "بنر 440g صيني", "استيكر فينيل ألماني"],
    defaultUnit: "متر مربع",
  },
  LASER: {
    titleAr: "شغلانة ماكينات ليزر (Laser Machines)",
    badgeAr: "قص وحفر أكريليك، خشب، دروع",
    defaultName: "درع تكريم أكريليك مقصوص بالليزر",
    materials: ["أكريليك شفاف 3mm", "أكريليك أسود 5mm", "خشب MDF 4mm", "صاج مدهون"],
    defaultUnit: "قطع",
  },
  OTHER: {
    titleAr: "مطبوعات مخصصة (Other Prints)",
    badgeAr: "مواصفات حرة وخاصة",
    defaultName: "مطبوع مخصص",
    materials: ["حسب الطلب", "خامات متعددة"],
    defaultUnit: "قطع",
  },
};

export function GenericJobModal({
  isOpen,
  category,
  onClose,
  onSave,
  departments,
  productTypes,
}: GenericJobModalProps) {
  const generatedId = useId();
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.DIGITAL;

  const [jobName, setJobName] = useState(config.defaultName);
  const [quantity, setQuantity] = useState<number>(100);
  const [unit, setUnit] = useState(config.defaultUnit);
  const [material, setMaterial] = useState(config.materials[0] ?? "");
  const [width, setWidth] = useState<number>(21);
  const [height, setHeight] = useState<number>(29.7);
  const [dimensionUnit, setDimensionUnit] = useState<"M" | "CM">("CM");
  const [unitPrice, setUnitPrice] = useState<number>(5);
  const [notes, setNotes] = useState("");
  const [finishing, setFinishing] = useState("سلوفان مط + تكسير");

  if (!isOpen) return null;

  const totalCost = Math.round(quantity * unitPrice * 100) / 100;

  const handleSave = () => {
    if (!jobName.trim()) {
      alert("يرجى إدخال اسم الشغلانة");
      return;
    }

    const matchedDept = departments.find(
      (d) =>
        d.name.toLowerCase().includes(category.toLowerCase()) ||
        d.name.includes(config.titleAr.split(" ")[1] ?? "")
    );
    const matchedPt = productTypes.find(
      (pt) =>
        pt.name.toLowerCase().includes(category.toLowerCase()) ||
        pt.name.includes(config.titleAr.split(" ")[1] ?? "")
    );

    const item: MasterOrderItem = {
      id: `job_${Date.now()}`,
      category,
      categoryLabelAr: config.titleAr,
      jobName: jobName.trim(),
      quantity: quantity || 1,
      width,
      height,
      measurementUnit: dimensionUnit,
      unit,
      material,
      finishing: finishing.trim(),
      notes: notes.trim(),
      totalCost,
      departmentId: matchedDept?.id,
      productTypeId: matchedPt?.id,
    };

    onSave(item);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-white/20 bg-card shadow-2xl overflow-hidden text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-primary/10 via-card to-card p-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{config.titleAr}</h2>
              <p className="text-2xs text-muted-foreground">{config.badgeAr}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <div>
            <label htmlFor={`job-name-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
              اسم الشغلانة (Job Name)*
            </label>
            <input
              id={`job-name-${generatedId}`}
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor={`quantity-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
                الكمية*
              </label>
              <input
                id={`quantity-${generatedId}`}
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor={`unit-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
                الوحدة
              </label>
              <input
                id={`unit-${generatedId}`}
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor={`unit-price-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
                سعر الوحدة (ج.م)
              </label>
              <input
                id={`unit-price-${generatedId}`}
                type="number"
                min="0"
                step="0.1"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`material-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
                نوع الخامة
              </label>
              <select
                id={`material-${generatedId}`}
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
              >
                {config.materials.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`finishing-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
                التشطيب والتجهيزات
              </label>
              <input
                id={`finishing-${generatedId}`}
                type="text"
                value={finishing}
                onChange={(e) => setFinishing(e.target.value)}
                placeholder="مثال: سلوفان حراري، تكسير، بصمة..."
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor={`width-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
                العرض
              </label>
              <input
                id={`width-${generatedId}`}
                type="number"
                step="0.1"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor={`height-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
                الارتفاع
              </label>
              <input
                id={`height-${generatedId}`}
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor={`dim-unit-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
                الوحدة
              </label>
              <select
                id={`dim-unit-${generatedId}`}
                value={dimensionUnit}
                onChange={(e) => setDimensionUnit(e.target.value as "M" | "CM")}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
              >
                <option value="CM">سم (CM)</option>
                <option value="M">متر (M)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor={`notes-${generatedId}`} className="block text-xs font-bold text-muted-foreground mb-1">
              ملاحظات إضافية
            </label>
            <textarea
              id={`notes-${generatedId}`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تعليمات تشغيل للمطبعة..."
              className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-primary/10 p-3.5 border border-primary/20">
            <span className="text-xs font-bold text-foreground">إجمالي الشغلانة المحسوب:</span>
            <span className="text-xl font-black text-primary font-mono">{totalCost.toFixed(2)} ج.م</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/70 bg-muted/40 p-4 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
            إلغاء
          </Button>
          <Button type="button" onClick={handleSave} className="rounded-xl font-bold px-5">
            <Check className="h-4 w-4 me-1.5" />
            <span>إضافة الشغلانة</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
