"use client";

/**
 * AssignDesignerSheet: picks a designer for NEW → ASSIGNED or REWORK_REQUIRED → ASSIGNED.
 * World-class Apple-inspired modal experience with fluid state management,
 * transition breadcrumbs, designer load meters, and instant double-click dispatch.
 * (FR-015, research.md R3, plan.md S1)
 */

import React, { useEffect, useState, useCallback } from "react";
import { Palette, ArrowLeft, X, UserCheck } from "lucide-react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";
import {
  type EligibleDesigner,
  DesignerSelect,
  ReassignReasonField,
} from "./AssignDesignerFields";

export type { EligibleDesigner };

export interface AssignDesignerSheetProps {
  readonly request: SheetRequest;
  readonly fetchDesigners: (workItemId: string) => Promise<EligibleDesigner[]>;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
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

function SheetHeader({ card, isReassignment, onCancel }: { readonly card: SheetRequest["card"]; readonly isReassignment: boolean; readonly onCancel: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-purple-500/25">
          <Palette className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-2xs font-bold">
            <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">الاستقبال</span>
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
            <span className="rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-purple-700 dark:text-purple-300">
              {isReassignment ? "إعادة تعيين للتصميم" : "التصميم"}
            </span>
          </div>
          <h2 className="text-base font-bold text-foreground line-clamp-1">
            {isReassignment ? "إعادة توجيه المصمم" : "تعيين مصمم وبدء العمل"}
          </h2>
          <p className="text-xs text-muted-foreground line-clamp-1">
            <span className="font-mono font-bold text-foreground">#{card.orderNumber}</span> — {card.title}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
        aria-label="إلغاء وإغلاق"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AssignActions({
  isReassignment,
  disabled,
  selectedDesignerName,
  onCancel,
}: {
  readonly isReassignment: boolean;
  readonly disabled: boolean;
  readonly selectedDesignerName?: string;
  readonly onCancel: () => void;
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-border/70 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="w-full sm:w-auto rounded-xl border border-border/80 bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-98 shadow-2xs"
      >
        إلغاء (Esc)
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-primary px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
      >
        <UserCheck className="h-4 w-4" />
        <span>
          {isReassignment
            ? "تأكيد إعادة التعيين"
            : selectedDesignerName
              ? `إسناد إلى ${selectedDesignerName}`
              : "تأكيد التعيين والتوجيه"}
        </span>
      </button>
    </div>
  );
}

function DesignerPickerSection({
  designers,
  selectedId,
  loading,
  onChange,
  onDoubleClick,
}: {
  readonly designers: readonly EligibleDesigner[];
  readonly selectedId: string;
  readonly loading: boolean;
  readonly onChange: (id: string) => void;
  readonly onDoubleClick: (id?: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5 text-primary" />
          <span>اختر المصمم المسؤول</span>
          <span className="text-rose-500">*</span>
        </span>
        <span className="text-2xs text-muted-foreground font-normal">انقر مرتين على أي مصمم للتأكيد المباشر</span>
      </label>
      <DesignerSelect
        designers={designers}
        selectedId={selectedId}
        loading={loading}
        onChange={onChange}
        onDoubleClickConfirm={onDoubleClick}
      />
    </div>
  );
}

export function AssignDesignerSheet({
  request,
  fetchDesigners,
  onConfirm,
  onCancel,
}: AssignDesignerSheetProps) {
  const { designers, designerId, setDesignerId, loading } = useDesignerList(request.card.id, fetchDesigners);
  const [reason, setReason] = useState("");
  const isReassignment = Boolean(request.card.assignee?.id);
  const selectedDesigner = designers.find((d) => d.id === designerId);

  const handleConfirmSubmit = useCallback((targetDesignerId?: string) => {
    const finalId = targetDesignerId ?? designerId;
    if (!finalId || (isReassignment && !reason.trim())) return;
    onConfirm({ designerId: finalId, ...(reason.trim() ? { reason: reason.trim() } : {}) });
  }, [designerId, isReassignment, reason, onConfirm]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleConfirmSubmit(); }} className="flex flex-col gap-4" dir="rtl">
      <SheetHeader card={request.card} isReassignment={isReassignment} onCancel={onCancel} />
      <DesignerPickerSection
        designers={designers}
        selectedId={designerId}
        loading={loading}
        onChange={setDesignerId}
        onDoubleClick={handleConfirmSubmit}
      />
      {isReassignment && <ReassignReasonField value={reason} onChange={setReason} />}
      <AssignActions
        isReassignment={isReassignment}
        disabled={!designerId || loading || (isReassignment && !reason.trim())}
        selectedDesignerName={selectedDesigner?.name}
        onCancel={onCancel}
      />
    </form>
  );
}
