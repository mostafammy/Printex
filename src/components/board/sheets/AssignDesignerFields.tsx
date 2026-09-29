"use client";

/**
 * Field subcomponents for AssignDesignerSheet.
 * (specs/017-press-floor-board)
 */

import React from "react";

export interface EligibleDesigner {
  readonly id: string;
  readonly name: string;
  readonly activeCount: number;
  readonly isSuggested?: boolean;
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm text-gray-500">
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      جاري تحميل قائمة المصممين...
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      لا يوجد مصممون مؤهلون متاحون حالياً في النظام.
    </div>
  );
}

export function DesignerSelect({
  designers,
  selectedId,
  loading,
  onChange,
}: {
  readonly designers: readonly EligibleDesigner[];
  readonly selectedId: string;
  readonly loading: boolean;
  readonly onChange: (id: string) => void;
}) {
  if (loading) return <LoadingState />;
  if (designers.length === 0) return <EmptyState />;

  return (
    <select
      id="assign-designer"
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      required
      className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">اختر المصمم...</option>
      {designers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name} {d.isSuggested ? "★ (مقترح)" : ""} ({d.activeCount} طلب نشط)
        </option>
      ))}
    </select>
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
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor="reassign-reason">
        سبب إعادة التعيين <span className="text-red-500">*</span>
      </label>
      <textarea
        id="reassign-reason"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        rows={2}
        placeholder="اذكر سبب تغيير المصمم..."
        className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
