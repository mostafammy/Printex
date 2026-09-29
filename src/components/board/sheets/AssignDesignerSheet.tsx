"use client";

/**
 * AssignDesignerSheet: picks a designer for NEW → ASSIGNED or REWORK_REQUIRED → ASSIGNED.
 * (FR-015, research.md R3, plan.md S1)
 */

import { useEffect, useState } from "react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

export interface EligibleDesigner {
  readonly id: string;
  readonly name: string;
  readonly activeCount: number;
  readonly isSuggested?: boolean;
}

export interface AssignDesignerSheetProps {
  readonly request: SheetRequest;
  readonly fetchDesigners: (workItemId: string) => Promise<EligibleDesigner[]>;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
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

function DesignerSelect({
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

function ReassignReasonField({
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

function useDesignerList(workItemId: string, fetcher: (id: string) => Promise<EligibleDesigner[]>) {
  const [designers, setDesigners] = useState<EligibleDesigner[]>([]);
  const [designerId, setDesignerId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetcher(workItemId)
      .then((list) => {
        if (!mounted) return;
        setDesigners(list);
        setLoading(false);
        const suggested = list.find((d) => d.isSuggested) ?? list[0];
        if (suggested) setDesignerId(suggested.id);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [workItemId, fetcher]);

  return { designers, designerId, setDesignerId, loading };
}

export function AssignDesignerSheet({
  request,
  fetchDesigners,
  onConfirm,
  onCancel,
}: AssignDesignerSheetProps) {
  const { designers, designerId, setDesignerId, loading } = useDesignerList(
    request.card.id,
    fetchDesigners,
  );
  const [reason, setReason] = useState("");
  const isReassignment = Boolean(request.card.assignee?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!designerId) return;
    onConfirm({
      designerId,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
  };

  const isSubmitDisabled = !designerId || loading || (isReassignment && !reason.trim());

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" dir="rtl">
      <h2 className="text-base font-semibold">
        {isReassignment ? "إعادة تعيين مصمم" : "تعيين مصمم"} — {request.card.title}
      </h2>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="assign-designer">
          المصمم <span className="text-red-500">*</span>
        </label>
        <DesignerSelect
          designers={designers}
          selectedId={designerId}
          loading={loading}
          onChange={setDesignerId}
        />
      </div>

      {isReassignment && <ReassignReasonField value={reason} onChange={setReason} />}

      <div className="flex justify-start gap-2 pt-1">
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {isReassignment ? "تأكيد إعادة التعيين" : "تعيين"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
