"use client";

import { useEffect, useRef, useState } from "react";

export type CustomerPickerProps = {
  value?: string | null;
  onSelect: (customerId: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

type CustomerResult = { id: string; name: string; phones: { phoneE164: string }[] };

export function CustomerPicker({ value, onSelect, disabled, autoFocus }: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
          if (response.ok) setResults((await response.json()) as CustomerResult[]);
        } finally {
          setLoading(false);
        }
      })();
    }, 150);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function select(customerId: string) {
    onSelect(customerId);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="relative" dir="rtl">
      <label htmlFor="customer-picker-search" className="mb-2 block text-sm font-medium">
        البحث عن العميل
      </label>
      <input
        ref={inputRef}
        id="customer-picker-search"
        autoFocus={autoFocus}
        disabled={disabled}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && results[activeIndex]) {
            event.preventDefault();
            select(results[activeIndex].id);
          } else if (event.key === "Escape") {
            setResults([]);
          }
        }}
        role="combobox"
        aria-controls="customer-picker-results"
        aria-expanded={results.length > 0}
        aria-activedescendant={results[activeIndex] ? `customer-result-${results[activeIndex].id}` : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2"
      />
      {loading && <p className="mt-2 text-sm text-muted-foreground">جارٍ البحث...</p>}
      {!loading && query && !results.length && <p className="mt-2 text-sm text-muted-foreground">لا توجد نتائج</p>}
      {results.length > 0 && (
        <ul id="customer-picker-results" role="listbox" className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card p-1 shadow-md">
          {results.map((customer, index) => (
            <li
              key={customer.id}
              id={`customer-result-${customer.id}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`cursor-pointer rounded px-3 py-2 ${index === activeIndex ? "bg-muted" : ""}`}
              onMouseDown={() => select(customer.id)}
            >
              <span className="block">{customer.name}</span>
              <span className="text-sm text-muted-foreground">{customer.phones[0]?.phoneE164}</span>
            </li>
          ))}
        </ul>
      )}
      {value && <span className="sr-only">العميل المحدد: {value}</span>}
    </div>
  );
}
