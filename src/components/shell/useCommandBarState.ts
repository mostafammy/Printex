"use client";

/**
 * useCommandBarState: state management and keyboard listeners for ⌘K CommandBar.
 * (specs/017-press-floor-board/spec.md FR-033, research.md R11, plan.md S1)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandBarRegistry, type CommandItem } from "~/lib/board/commandBar/CommandBarRegistry";
import { PagesSource } from "~/lib/board/commandBar/sources/PagesSource";
import { OrdersSource } from "~/lib/board/commandBar/sources/OrdersSource";
import { CustomersSource } from "~/lib/board/commandBar/sources/CustomersSource";

function useCommandBarSearch(registry: CommandBarRegistry, query: string) {
  const [results, setResults] = useState<readonly CommandItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        const items = await registry.searchAll(query);
        setResults(items);
        setIsLoading(false);
      })();
    }, 150);
    return () => clearTimeout(timer);
  }, [query, registry]);

  return { results, isLoading };
}

function useShortcutListener(onToggle: () => void, onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onToggle();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggle, onClose]);
}

interface NavigationKeysParams {
  readonly results: readonly CommandItem[];
  readonly selectedIndex: number;
  readonly setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  readonly onSelect: (item: CommandItem) => void;
}

function useNavigationKeys({
  results,
  selectedIndex,
  setSelectedIndex,
  onSelect,
}: NavigationKeysParams) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((p) => (p + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((p) => (p - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      onSelect(results[selectedIndex]);
    }
  };
}

function useCommandBarRegistry() {
  return useMemo(() => {
    const reg = new CommandBarRegistry();
    reg.register(new PagesSource());
    reg.register(new OrdersSource());
    reg.register(new CustomersSource());
    return reg;
  }, []);
}

export function useCommandBarState() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const registry = useCommandBarRegistry();
  const { results, isLoading } = useCommandBarSearch(registry, query);
  useShortcutListener(() => setIsOpen((p) => !p), () => setIsOpen(false));

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSelect = (item: CommandItem) => {
    setIsOpen(false);
    router.push(item.href);
  };

  const handleNavKeys = useNavigationKeys({
    results,
    selectedIndex,
    setSelectedIndex,
    onSelect: handleSelect,
  });

  return {
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
  };
}
