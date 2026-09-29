"use client";

/**
 * RouteDepartmentSheet: captures department for READY_FOR_PRODUCTION → IN_PRODUCTION (unrouted jobs).
 * Apple-grade interactive department selector with clean cards and instant selection.
 * (FR-015, research.md R3, plan.md S1)
 */

import React, { useEffect, useState } from "react";
import { Building, ArrowLeft, X, Check, Factory } from "lucide-react";
import type { SheetRequest } from "~/lib/board/sheets/SheetManager";

interface Department {
  readonly id: string;
  readonly name: string;
}

export interface RouteDepartmentSheetProps {
  readonly request: SheetRequest;
  readonly fetchDepartments: () => Promise<Department[]>;
  readonly onConfirm: (input: Record<string, unknown>) => void;
  readonly onCancel: () => void;
}

function useDepartmentList(fetchDepartments: () => Promise<Department[]>) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchDepartments()
      .then((list) => {
        if (!mounted) return;
        setDepartments(list);
        setLoading(false);
        if (list[0]) setDepartmentId(list[0].id);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [fetchDepartments]);

  return { departments, departmentId, setDepartmentId, loading };
}

function RouteDepartmentHeader({ card, onCancel }: { readonly card: SheetRequest["card"]; readonly onCancel: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/25">
          <Factory className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-2xs font-bold">
            <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">جاهز للطباعة</span>
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
            <span className="rounded-md bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-cyan-700 dark:text-cyan-300">
              قيد الإنتاج
            </span>
          </div>
          <h2 className="text-base font-bold text-foreground line-clamp-1">توجيه لقسم الإنتاج</h2>
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

function DepartmentCardItem({
  dept,
  isSelected,
  onSelect,
  onDoubleClick,
}: {
  readonly dept: Department;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDoubleClick: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(dept.id)}
      onDoubleClick={() => onDoubleClick(dept.id)}
      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all active:scale-98 ${
        isSelected
          ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/25 dark:bg-cyan-500/15"
          : "border-border/70 bg-card/60 hover:bg-muted/40"
      }`}
    >
      <span className={`text-xs font-bold ${isSelected ? "text-cyan-700 dark:text-cyan-300" : "text-foreground"}`}>
        {dept.name}
      </span>
      <div
        className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border transition-all ${
          isSelected ? "border-cyan-600 bg-cyan-600 text-white" : "border-border/80 bg-background"
        }`}
      >
        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
      </div>
    </div>
  );
}

function DepartmentGrid({
  departments,
  selectedId,
  loading,
  onSelect,
  onDoubleClick,
}: {
  readonly departments: readonly Department[];
  readonly selectedId: string;
  readonly loading: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDoubleClick: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 py-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }
  if (departments.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">لا توجد أقسام مسجلة</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto pe-1">
      {departments.map((dept) => (
        <DepartmentCardItem
          key={dept.id}
          dept={dept}
          isSelected={selectedId === dept.id}
          onSelect={onSelect}
          onDoubleClick={onDoubleClick}
        />
      ))}
    </div>
  );
}

function RouteActions({ disabled, onCancel }: { readonly disabled: boolean; readonly onCancel: () => void }) {
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
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 disabled:opacity-40 disabled:pointer-events-none"
      >
        <Factory className="h-4 w-4" />
        <span>توجيه وبدء الإنتاج</span>
      </button>
    </div>
  );
}

export function RouteDepartmentSheet({
  request,
  fetchDepartments,
  onConfirm,
  onCancel,
}: RouteDepartmentSheetProps) {
  const { departments, departmentId, setDepartmentId, loading } = useDepartmentList(fetchDepartments);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (departmentId) onConfirm({ departmentId });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4.5" dir="rtl">
      <RouteDepartmentHeader card={request.card} onCancel={onCancel} />
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-foreground flex items-center gap-1">
          <Building className="h-3.5 w-3.5 text-primary" />
          <span>اختر قسم التشغيل والإنتاج</span>
          <span className="text-rose-500">*</span>
        </label>
        <DepartmentGrid
          departments={departments}
          selectedId={departmentId}
          loading={loading}
          onSelect={setDepartmentId}
          onDoubleClick={(id) => {
            setDepartmentId(id);
            onConfirm({ departmentId: id });
          }}
        />
      </div>
      <RouteActions disabled={!departmentId || loading} onCancel={onCancel} />
    </form>
  );
}
