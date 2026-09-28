"use client";

/**
 * SliceSwitcher: quick-switch pills for role slices and filter toggles.
 * (specs/017-press-floor-board/spec.md FR-021, FR-022, plan.md S1)
 */

import React, { useState } from "react";
import { SLICES, type SliceId } from "~/lib/board/slices";
import type { BoardFilters, BoardPagination } from "~/lib/board/types";
import { AlertCircle, Archive, Flame } from "lucide-react";
import { useBoardController } from "./hooks/useBoardController";

export interface SliceSwitcherProps {
  readonly activeSlice: SliceId;
  readonly availableSlices: readonly SliceId[];
  readonly onSelectSlice: (slice: SliceId) => void;
  readonly filters: BoardFilters;
  readonly onUpdateFilters: (filters: BoardFilters) => void;
  readonly pagination?: BoardPagination;
}

function SlicePills({
  activeSlice,
  availableSlices,
  onSelectSlice,
}: {
  readonly activeSlice: SliceId;
  readonly availableSlices: readonly SliceId[];
  readonly onSelectSlice: (slice: SliceId) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
      {availableSlices.map((sliceId) => {
        const def = SLICES.find((s) => s.id === sliceId);
        if (!def) return null;
        const isActive = activeSlice === sliceId;
        return (
          <button
            key={sliceId}
            type="button"
            onClick={() => onSelectSlice(sliceId)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              isActive
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {def.labelAr}
          </button>
        );
      })}
    </div>
  );
}

function FilterToggleChip({
  active,
  onClick,
  icon,
  label,
  activeClass,
}: {
  readonly active?: boolean;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-all ${
        active
          ? activeClass
          : "border-border/60 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FilterChips({
  filters,
  onUpdateFilters,
}: {
  readonly filters: BoardFilters;
  readonly onUpdateFilters: (filters: BoardFilters) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <FilterToggleChip
        active={filters.urgentOnly}
        onClick={() => onUpdateFilters({ ...filters, urgentOnly: !filters.urgentOnly })}
        icon={<Flame className="h-3 w-3 text-red-500" />}
        label="عاجل فقط"
        activeClass="border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
      />
      <FilterToggleChip
        active={filters.overdueOnly}
        onClick={() => onUpdateFilters({ ...filters, overdueOnly: !filters.overdueOnly })}
        icon={<AlertCircle className="h-3 w-3 text-amber-500" />}
        label="متأخر فقط"
        activeClass="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      />
      <FilterToggleChip
        active={filters.archive}
        onClick={() => onUpdateFilters({ ...filters, archive: !filters.archive })}
        icon={<Archive className="h-3 w-3 text-muted-foreground" />}
        label="الأرشيف"
        activeClass="border-primary/40 bg-primary/10 text-primary"
      />
    </div>
  );
}

function BoardPaginationControls({ pagination }: { readonly pagination: BoardPagination }) {
  const controller = useBoardController();
  const [isLoading, setIsLoading] = useState(false);
  const totalPages = pagination.totalCount ? Math.ceil(pagination.totalCount / pagination.pageSize) : 1;
  if (totalPages <= 1 && !pagination.hasMore) return null;

  const handleLoadMore = () => {
    if (isLoading) return;
    setIsLoading(true);
    void controller.loadMore().finally(() => setIsLoading(false));
  };

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="font-mono text-[11px] px-1">
        {pagination.page} / {totalPages}
      </span>
      {pagination.hasMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isLoading}
          className="rounded-md border border-border/60 bg-card/60 px-2 py-0.5 font-medium hover:bg-muted disabled:opacity-50"
        >
          {isLoading ? "جاري التحميل..." : "تحميل المزيد"}
        </button>
      )}
    </div>
  );
}

export function SliceSwitcher({
  activeSlice,
  availableSlices,
  onSelectSlice,
  filters,
  onUpdateFilters,
  pagination,
}: SliceSwitcherProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-4 py-2 backdrop-blur-xs">
      <SlicePills
        activeSlice={activeSlice}
        availableSlices={availableSlices}
        onSelectSlice={onSelectSlice}
      />
      <div className="flex items-center gap-3">
        {pagination && <BoardPaginationControls pagination={pagination} />}
        <FilterChips filters={filters} onUpdateFilters={onUpdateFilters} />
      </div>
    </div>
  );
}
