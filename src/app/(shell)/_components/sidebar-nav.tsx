"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  Inbox,
  Palette,
  Printer,
  Tag,
  Truck,
  Receipt,
  Coins,
  ShieldAlert,
  Layers,
  ChevronLeft,
} from "lucide-react";

import type { Actor } from "~/server/core";
import { filterNavByPermissions, navItems, type NavItem } from "../nav";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Clock,
  CheckCircle2,
  Inbox,
  Palette,
  Printer,
  Tag,
  Truck,
  Receipt,
  Coins,
  ShieldAlert,
};

const SECTION_HEADERS: Record<string, string> = {
  workspace: "مساحة العمل",
  operations: "العمليات والإنتاج",
  finance: "المالية والتقارير",
  management: "إدارة النظام",
};

const COLOR_MAP: Record<string, { bg: string; text: string; activeBg: string }> = {
  "my-queue": {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    text: "text-indigo-600 dark:text-indigo-400",
    activeBg: "bg-indigo-500/15",
  },
  review: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400",
    text: "text-purple-600 dark:text-purple-400",
    activeBg: "bg-purple-500/15",
  },
  reception: {
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
    text: "text-cyan-700 dark:text-cyan-400",
    activeBg: "bg-cyan-500/15",
  },
  design: {
    bg: "bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400",
    text: "text-pink-600 dark:text-pink-400",
    activeBg: "bg-pink-500/15",
  },
  production: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
    text: "text-blue-600 dark:text-blue-400",
    activeBg: "bg-blue-500/15",
  },
  pricing: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
    text: "text-amber-700 dark:text-amber-400",
    activeBg: "bg-amber-500/15",
  },
  delivery: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    activeBg: "bg-emerald-500/15",
  },
  "finance-expenses": {
    bg: "bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400",
    text: "text-rose-600 dark:text-rose-400",
    activeBg: "bg-rose-500/15",
  },
  "finance-daily-cash": {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    activeBg: "bg-emerald-500/15",
  },
  admin: {
    bg: "bg-slate-500/10 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300",
    text: "text-slate-700 dark:text-slate-300",
    activeBg: "bg-slate-500/15",
  },
};

function SidebarNavItem({ item }: { item: NavItem }) {
  let currentPath = "";
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    currentPath = usePathname() ?? "";
  } catch {
    currentPath = "";
  }

  const IconComponent = (item.iconName ? ICON_MAP[item.iconName] : undefined) ?? Layers;
  const colorInfo = COLOR_MAP[item.id] ?? {
    bg: "bg-primary/10 text-primary",
    text: "text-primary",
    activeBg: "bg-primary/15",
  };
  const isActive =
    currentPath === item.href ||
    (item.href !== "/" && currentPath.startsWith(item.href));

  return (
    <Link
      href={item.href}
      className={`group relative flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] ${
        isActive
          ? "bg-gradient-to-r from-primary/15 via-primary/10 to-transparent text-primary font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] dark:from-primary/25 dark:via-primary/15"
          : "text-foreground/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-foreground hover:translate-x-[-2px]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 group-hover:rotate-2 ${
            isActive
              ? "bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/35"
              : `${colorInfo.bg} shadow-2xs`
          }`}
        >
          <IconComponent className="h-4 w-4" />
        </div>
        <span className="tracking-tight text-[13.5px]">{item.label}</span>
      </div>

      {isActive ? (
        <div
          aria-hidden="true"
          className="h-5 w-1.5 rounded-full bg-gradient-to-b from-primary to-indigo-600 shadow-[0_0_10px_rgba(0,113,227,0.7)] animate-pulse"
        />
      ) : (
        <ChevronLeft className="h-4 w-4 text-muted-foreground/30 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-[-2px]" />
      )}
    </Link>
  );
}

export function SidebarNav({ actor }: { actor: Actor }) {
  const items = filterNavByPermissions(actor, navItems);

  // Group items by section while preserving original order
  const groupedSections: { sectionKey: string; items: NavItem[] }[] = [];
  const sectionMap = new Map<string, NavItem[]>();

  for (const item of items) {
    const secKey = item.section ?? "workspace";
    if (!sectionMap.has(secKey)) {
      const arr: NavItem[] = [];
      sectionMap.set(secKey, arr);
      groupedSections.push({ sectionKey: secKey, items: arr });
    }
    sectionMap.get(secKey)!.push(item);
  }

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="flex flex-col gap-6 py-2"
    >
      {groupedSections.map(({ sectionKey, items: sectionItems }) => (
        <div key={sectionKey} className="flex flex-col gap-1.5">
          <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {SECTION_HEADERS[sectionKey] ?? sectionKey}
          </div>
          <div className="flex flex-col gap-1">
            {sectionItems.map((item) => (
              <SidebarNavItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
