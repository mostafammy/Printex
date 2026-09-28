"use client";

/**
 * CommandBar: ⌘K quick switcher for navigation, orders, customers, and work items.
 * (specs/017-press-floor-board/spec.md FR-033, research.md R11, plan.md S1)
 */

import React from "react";
import { Search, X } from "lucide-react";
import type { CommandItem } from "~/lib/board/commandBar/CommandBarRegistry";
import { useCommandBarState } from "./useCommandBarState";

function CommandBarHeader({
  query,
  onQueryChange,
  inputRef,
  onKeyDown,
}: {
  readonly query: string;
  readonly onQueryChange: (val: string) => void;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div className="flex items-center border-b border-border/60 px-3 py-2">
      <Search className="h-4 w-4 text-muted-foreground me-2" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="ابحث في الصفحات، الطلبات، العملاء... (⌘K)"
        className="flex-1 bg-transparent text-sm font-medium outline-hidden placeholder:text-muted-foreground"
      />
      {query ? (
        <button type="button" onClick={() => onQueryChange("")} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      ) : (
        <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
      )}
    </div>
  );
}

function CommandResultItem({
  item,
  isSelected,
  onSelect,
}: {
  readonly item: CommandItem;
  readonly isSelected: boolean;
  readonly onSelect: (item: CommandItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-xs transition-colors ${
        isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-foreground"
      }`}
    >
      <div className="flex flex-col">
        <span>{item.title}</span>
        {item.subtitle ? <span className="text-[10px] text-muted-foreground">{item.subtitle}</span> : null}
      </div>
      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{item.category}</span>
    </button>
  );
}

function CommandBarResults({
  results,
  isLoading,
  query,
  selectedIndex,
  onSelect,
}: {
  readonly results: readonly CommandItem[];
  readonly isLoading: boolean;
  readonly query: string;
  readonly selectedIndex: number;
  readonly onSelect: (item: CommandItem) => void;
}) {
  if (isLoading) return <p className="p-4 text-center text-xs text-muted-foreground">جاري البحث...</p>;
  if (results.length === 0) {
    return (
      <p className="p-4 text-center text-xs text-muted-foreground">
        {query.trim() ? "لا توجد نتائج مطابقة" : "اكتب للبحث في النظام"}
      </p>
    );
  }
  return (
    <div className="max-h-72 overflow-y-auto p-2">
      {results.map((item, idx) => (
        <CommandResultItem key={item.id} item={item} isSelected={idx === selectedIndex} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function CommandBar() {
  const {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    selectedIndex,
    results,
    isLoading,
    inputRef,
    handleSelect,
    handleNavKeys,
  } = useCommandBarState();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="شريط الأوامر والبحث"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh] backdrop-blur-xs animate-in fade-in duration-100"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border/80 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CommandBarHeader query={query} onQueryChange={setQuery} inputRef={inputRef} onKeyDown={handleNavKeys} />
        <CommandBarResults results={results} isLoading={isLoading} query={query} selectedIndex={selectedIndex} onSelect={handleSelect} />
      </div>
    </div>
  );
}
