"use client";

import React from "react";
import { Trash2, Ruler, Sparkles, Building2 } from "lucide-react";
import type { ClientDepartment, ClientProductType, OrderItemState } from "./types";

export interface ItemCardProps {
  readonly item: OrderItemState;
  readonly index: number;
  readonly departments: ClientDepartment[];
  readonly productTypes: ClientProductType[];
  readonly canDelete: boolean;
  readonly onChange: (index: number, patch: Partial<OrderItemState>) => void;
  readonly onDelete: (index: number) => void;
}

const inputCls =
  "w-full rounded-2xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/20 shadow-2xs transition-all";

function ItemHeader({
  index,
  item,
  canDelete,
  onDelete,
}: {
  readonly index: number;
  readonly item: OrderItemState;
  readonly canDelete: boolean;
  readonly onDelete: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground font-mono text-xs font-black shadow-xs">
          {index + 1}
        </span>
        <span className="text-sm font-black text-foreground">
          {item.description ? item.description : `صنف عمل #${index + 1}`}
        </span>
      </div>

      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-2xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>حذف الصنف</span>
        </button>
      )}
    </div>
  );
}

function ItemProductRow({
  index,
  item,
  departments,
  productTypes,
  onChange,
}: {
  readonly index: number;
  readonly item: OrderItemState;
  readonly departments: ClientDepartment[];
  readonly productTypes: ClientProductType[];
  readonly onChange: (index: number, patch: Partial<OrderItemState>) => void;
}) {
  const handleProductSelect = (ptId: string) => {
    const selected = productTypes.find((p) => p.id === ptId);
    onChange(index, {
      productTypeId: ptId,
      departmentId: selected?.defaultDepartmentId ?? item.departmentId,
      requiresDesign: selected ? selected.defaultRequiresDesign : item.requiresDesign,
      requiresReview: selected ? selected.defaultRequiresReview : item.requiresReview,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-2xs font-bold text-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" />
          نوع المنتج النموذجي
        </label>
        <select
          name={`item.${index}.productTypeId`}
          value={item.productTypeId}
          onChange={(e) => handleProductSelect(e.target.value)}
          className={inputCls}
        >
          <option value="">بدون نوع محدد (صنف مخصص)</option>
          {productTypes.map((pt) => (
            <option key={pt.id} value={pt.id}>
              {pt.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-2xs font-bold text-foreground">الكمية المطلوبة *</label>
        <input
          name={`item.${index}.quantity`}
          type="number"
          min={1}
          required
          placeholder="مثال: 500"
          value={item.quantity}
          onChange={(e) => onChange(index, { quantity: e.target.value === "" ? "" : Number(e.target.value) })}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-2xs font-bold text-foreground flex items-center gap-1">
          <Building2 className="h-3 w-3 text-teal-500" />
          قسم المصنع المسؤول
        </label>
        <select
          name={`item.${index}.departmentId`}
          value={item.departmentId}
          onChange={(e) => onChange(index, { departmentId: e.target.value })}
          className={inputCls}
        >
          <option value="">تلقائي حسب نوع المنتج</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ItemDimensionsRow({
  index,
  item,
  onChange,
}: {
  readonly index: number;
  readonly item: OrderItemState;
  readonly onChange: (index: number, patch: Partial<OrderItemState>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-2xs font-bold text-foreground flex items-center gap-1">
          <Ruler className="h-3 w-3 text-purple-500" />
          العرض
        </label>
        <input
          name={`item.${index}.widthValue`}
          type="number"
          step="0.01"
          min={0.01}
          required
          placeholder="العرض..."
          value={item.widthValue}
          onChange={(e) => onChange(index, { widthValue: e.target.value === "" ? "" : Number(e.target.value) })}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-2xs font-bold text-foreground">الارتفاع</label>
        <input
          name={`item.${index}.heightValue`}
          type="number"
          step="0.01"
          min={0.01}
          required
          placeholder="الارتفاع..."
          value={item.heightValue}
          onChange={(e) => onChange(index, { heightValue: e.target.value === "" ? "" : Number(e.target.value) })}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-2xs font-bold text-foreground">وحدة القياس</label>
        <select
          name={`item.${index}.dimensionUnit`}
          value={item.dimensionUnit}
          onChange={(e) => onChange(index, { dimensionUnit: e.target.value as OrderItemState["dimensionUnit"] })}
          className={inputCls}
        >
          <option value="CM">CM (سنتيمتر)</option>
          <option value="MM">MM (مليمتر)</option>
          <option value="M">M (متر)</option>
          <option value="IN">IN (بوصة)</option>
        </select>
      </div>
    </div>
  );
}

function ItemSpecsDetailsRow({
  index,
  item,
  onChange,
}: {
  readonly index: number;
  readonly item: OrderItemState;
  readonly onChange: (index: number, patch: Partial<OrderItemState>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-2xs font-bold text-foreground">نوع الخامة أو الورق</label>
        <input
          name={`item.${index}.material`}
          type="text"
          placeholder="مثال: كوشيه 350 جم، فينيل لامع..."
          value={item.material}
          onChange={(e) => onChange(index, { material: e.target.value })}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-2xs font-bold text-foreground">ملاحظات التشطيب والإنهاء</label>
        <input
          name={`item.${index}.finishNotes`}
          type="text"
          placeholder="مثال: سلوفان مطفي وجهين، بصمة ذهبي..."
          value={item.finishNotes}
          onChange={(e) => onChange(index, { finishNotes: e.target.value })}
          className={inputCls}
        />
      </div>
    </div>
  );
}

function ItemWorkflowSwitches({
  index,
  item,
  onChange,
}: {
  readonly index: number;
  readonly item: OrderItemState;
  readonly onChange: (index: number, patch: Partial<OrderItemState>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors">
        <input
          type="checkbox"
          name={`item.${index}.requiresDesign`}
          checked={item.requiresDesign}
          onChange={(e) => onChange(index, { requiresDesign: e.target.checked })}
          className="h-4 w-4 rounded accent-primary cursor-pointer"
        />
        <span className="text-2xs font-bold text-foreground">يتطلب مرحلة تصميم</span>
      </label>

      <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors">
        <input
          type="checkbox"
          name={`item.${index}.requiresReview`}
          checked={item.requiresReview}
          onChange={(e) => onChange(index, { requiresReview: e.target.checked })}
          className="h-4 w-4 rounded accent-primary cursor-pointer"
        />
        <span className="text-2xs font-bold text-foreground">يتطلب مراجعة واعتماد</span>
      </label>
    </div>
  );
}

export function ItemCard({
  item,
  index,
  departments,
  productTypes,
  canDelete,
  onChange,
  onDelete,
}: ItemCardProps) {
  return (
    <div className="rounded-3xl border border-white/20 bg-card/70 p-5 sm:p-7 shadow-xl backdrop-blur-2xl transition-all duration-300 hover:border-primary/30 hover:shadow-2xl dark:border-white/10 dark:bg-card/50 flex flex-col gap-4">
      <ItemHeader index={index} item={item} canDelete={canDelete} onDelete={onDelete} />
      
      <div className="flex flex-col gap-1.5">
        <label className="text-2xs font-bold text-foreground">عنوان أو وصف الصنف *</label>
        <input
          name={`item.${index}.description`}
          type="text"
          placeholder="مثال: لافتات موقع مشروع المونوريل"
          value={item.description}
          onChange={(e) => onChange(index, { description: e.target.value })}
          className={inputCls}
        />
      </div>

      <ItemProductRow index={index} item={item} departments={departments} productTypes={productTypes} onChange={onChange} />
      <ItemDimensionsRow index={index} item={item} onChange={onChange} />
      <ItemSpecsDetailsRow index={index} item={item} onChange={onChange} />
      <ItemWorkflowSwitches index={index} item={item} onChange={onChange} />
    </div>
  );
}
