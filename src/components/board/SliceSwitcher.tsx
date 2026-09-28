"use client";

/**
 * SliceSwitcher: the slice dropdown, filter toggles, and pagination.
 * (specs/017-press-floor-board/spec.md FR-021, FR-022, plan.md S1)
 *
 * The slice row used to be a second row of chips directly above the station
 * chips, both Arabic, both with an active state, ~60px apart — an operator
 * could not tell "which slice am I in" from "which station am I looking at".
 * It is now a single labelled dropdown, so the two controls are different
 * shapes and only one of them is a row of chips.
 */

import React from "react";
import Link from "next/link";
import { SLICES, type SliceId } from "~/lib/board/slices";
import type { BoardFilters, BoardPagination } from "~/lib/board/types";
import { AlertCircle, Archive, ChevronDown, Flame } from "lucide-react";

export interface SliceSwitcherProps {
  readonly activeSlice: SliceId;
  readonly availableSlices: readonly SliceId[];
  readonly onSelectSlice: (slice: SliceId) => void;
  readonly filters: BoardFilters;
  readonly onUpdateFilters: (filters: BoardFilters) => void;
  readonly pagination?: BoardPagination;
  readonly viewSwitcher?: React.ReactNode;
}

function SliceDropdown({
  activeSlice,
  availableSlices,
  onSelectSlice,
}: {
  readonly activeSlice: SliceId;
  readonly availableSlices: readonly SliceId[];
  readonly onSelectSlice: (slice: SliceId) => void;
}) {
  const activeDef = SLICES.find((s) => s.id === activeSlice);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="board-slice" className="text-xs font-medium text-muted-foreground">
        العرض
      </label>
      <div className="relative">
        <select
          id="board-slice"
          value={activeSlice}
          onChange={(e) => onSelectSlice(e.target.value as SliceId)}
          className="min-h-11 appearance-none rounded-lg border border-border/60 bg-card ps-3 pe-8 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {availableSlices.map((sliceId) => {
            const def = SLICES.find((s) => s.id === sliceId);
            if (!def) return null;
            return (
              <option key={sliceId} value={sliceId}>
                {def.labelAr}
              </option>
            );
          })}
        </select>
        <ChevronDown
          className="pointer-events-none absolute inset-y-0 end-2 my-auto h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      {activeDef && (
        <span className="hidden text-xs text-muted-foreground lg:inline">
          {activeDef.stations.length === 7
            ? "كل المحطات"
            : `${activeDef.stations.length} محطة`}
        </span>
      )}
    </div>
  );
}

interface FilterToggleChipProps {
  readonly active?: boolean;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly activeClass: string;
}

function FilterToggleChip({ active, onClick, icon, label, activeClass }: FilterToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active ?? false}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 font-medium transition-colors ${
        active
          ? activeClass
          : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"
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
        icon={<Flame className="h-4 w-4 text-destructive" aria-hidden="true" />}
        label="عاجل فقط"
        activeClass="border-destructive/50 bg-destructive/10 text-destructive"
      />
      <FilterToggleChip
        active={filters.overdueOnly}
        onClick={() => onUpdateFilters({ ...filters, overdueOnly: !filters.overdueOnly })}
        icon={<AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />}
        label="متأخر فقط"
        activeClass="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      />
      <FilterToggleChip
        active={filters.archive}
        onClick={() => onUpdateFilters({ ...filters, archive: !filters.archive })}
        icon={<Archive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        label="الأرشيف"
        activeClass="border-primary/40 bg-primary/10 text-primary"
      />
    </div>
  );
}

function BoardPaginationControls({ pagination }: { readonly pagination: BoardPagination }) {
  const totalPages = pagination.totalCount
    ? Math.ceil(pagination.totalCount / pagination.pageSize)
    : 1;
  if (totalPages <= 1 && !pagination.hasMore) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {pagination.page > 1 && (
        <Link
          href={`/board?page=${pagination.page - 1}`}
          className="rounded-lg border border-border/60 bg-card px-2 py-1 font-medium hover:bg-muted"
        >
          السابق
        </Link>
      )}
      <span className="px-1 font-mono text-[11px] tabular-nums">
        {pagination.page} / {totalPages}
      </span>
      {pagination.hasMore && (
        <Link
          href={`/board?page=${pagination.page + 1}`}
          className="rounded-lg border border-border/60 bg-card px-2 py-1 font-medium hover:bg-muted"
        >
          التالي
        </Link>
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
  viewSwitcher,
}: SliceSwitcherProps) {
  const activeFilterCount = [filters.urgentOnly, filters.overdueOnly, filters.archive].filter(
    Boolean,
  ).length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-4 py-2 backdrop-blur-xs">
      <div className="flex items-center gap-3">
        {viewSwitcher}
        <SliceDropdown
          activeSlice={activeSlice}
          availableSlices={availableSlices}
          onSelectSlice={onSelectSlice}
        />
      </div>
      <div className="flex items-center gap-3">
        {pagination && <BoardPaginationControls pagination={pagination} />}
        <FilterChips filters={filters} onUpdateFilters={onUpdateFilters} />
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => onUpdateFilters({})}
            className="min-h-11 rounded-lg px-2 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            مسح التصفية
          </button>
        )}
      </div>
    </div>
  );
}
