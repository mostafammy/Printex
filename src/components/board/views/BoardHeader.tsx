"use client";

/**
 * BoardHeader: the slice dropdown, filter toggles, pagination, and the view
 * mode switcher, above the board itself.
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
import { AlertCircle, Archive, ChevronDown, Flame, Plus } from "lucide-react";

export interface BoardHeaderProps {
  readonly activeSlice: SliceId;
  readonly availableSlices: readonly SliceId[];
  readonly onSelectSlice: (slice: SliceId) => void;
  readonly filters: BoardFilters;
  readonly onUpdateFilters: (filters: BoardFilters) => void;
  readonly pagination?: BoardPagination;
  readonly viewSwitcher?: React.ReactNode;
}

/** Only ever shown from a wide screen; the station count is noise on a phone. */
function SliceStationCount({ activeSlice }: { readonly activeSlice: SliceId }) {
  const activeDef = SLICES.find((s) => s.id === activeSlice);
  if (!activeDef) return null;
  return (
    <span className="hidden text-xs text-muted-foreground lg:inline">
      {activeDef.stations.length === 7
        ? "كل المحطات"
        : `${activeDef.stations.length} محطة`}
    </span>
  );
}

function SliceDropdown(props: {
  readonly activeSlice: SliceId;
  readonly availableSlices: readonly SliceId[];
  readonly onSelectSlice: (slice: SliceId) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="board-slice" className="text-xs font-medium text-muted-foreground">
        العرض
      </label>
      <div className="relative">
        <select
          id="board-slice"
          value={props.activeSlice}
          onChange={(e) => props.onSelectSlice(e.target.value as SliceId)}
          className="min-h-11 appearance-none rounded-[var(--board-radius)] border border-[var(--board-line-strong)] bg-card ps-3 pe-8 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {props.availableSlices.map((sliceId) => {
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
      <SliceStationCount activeSlice={props.activeSlice} />
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
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-[var(--board-radius)] border px-3 text-[13px] font-medium transition-colors ${
        active
          ? activeClass
          : "border-[var(--board-line-strong)] bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FilterChips(props: {
  readonly filters: BoardFilters;
  readonly onUpdateFilters: (filters: BoardFilters) => void;
}) {
  const { filters, onUpdateFilters } = props;
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
          className="rounded-[var(--board-radius)] border border-[var(--board-line-strong)] bg-card px-2 py-1 font-medium hover:bg-muted"
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
          className="rounded-[var(--board-radius)] border border-[var(--board-line-strong)] bg-card px-2 py-1 font-medium hover:bg-muted"
        >
          التالي
        </Link>
      )}
    </div>
  );
}

export function BoardHeader(props: BoardHeaderProps) {
  const { filters, onUpdateFilters } = props;
  const activeFilterCount = [filters.urgentOnly, filters.overdueOnly, filters.archive].filter(
    Boolean,
  ).length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--board-line-strong)] bg-background px-3 py-1.5">
      <div className="flex items-center gap-3">
        {props.viewSwitcher}
        <SliceDropdown
          activeSlice={props.activeSlice}
          availableSlices={props.availableSlices}
          onSelectSlice={props.onSelectSlice}
        />
      </div>
      <div className="flex items-center gap-3">
        {props.pagination && <BoardPaginationControls pagination={props.pagination} />}
        <FilterChips filters={filters} onUpdateFilters={onUpdateFilters} />
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => onUpdateFilters({})}
            className="min-h-11 px-2 text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            مسح التصفية
          </button>
        )}
        <Link
          href="/reception/new"
          data-testid="board-add-order-btn"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--board-radius)] bg-primary px-3 text-[13px] font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          title="إضافة طلب أو صنف جديد (الانتقال إلى شاشة الاستقبال)"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>إضافة طلب / صنف</span>
        </Link>
      </div>
    </div>
  );
}
