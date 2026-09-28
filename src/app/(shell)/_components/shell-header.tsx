"use client";

import React from "react";
import Link from "next/link";
import {
  Printer,
  Search,
} from "lucide-react";
import ar from "~/messages/ar.json";

interface ShellHeaderProps {
  readonly userName?: string;
  readonly roleLabel?: string;
  /**
   * Slot for the notification bell (053, FR-020). Rendered beside the live
   * system indicator so the bell appears on every authenticated page for
   * every role. Optional so the header still renders when no bell is passed —
   * e.g. a screen that resolves an actor but has no notification context.
   */
  readonly bell?: React.ReactNode;
}

export function ShellHeader({
  userName = "مستخدم النظام",
  roleLabel = "مسؤول",
  bell,
}: ShellHeaderProps) {
  return (
    <header className="z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-border/70 bg-card/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Keyboard escape hatch: 14 sidebar links sit before the first
          focusable element in `<main>`, so without this a keyboard user
          tabs the whole nav on every page load. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        تخطَّ إلى المحتوى
      </a>

      {/* Brand Identity / App Emblem */}
      <div className="flex items-center gap-3">
        <Link
          href="/my-queue"
          className="group flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Printer className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-none text-foreground">
              {ar.ui.appName}
            </span>
            <span className="mt-0.5 text-2xs font-medium text-muted-foreground">
              نظام إدارة المطابع الذكي
            </span>
          </div>
        </Link>
      </div>

      {/* Center: order search. Deliberately NOT labelled with a ⌘K badge —
          no such shortcut exists anywhere in the app, and an affordance that
          lies costs a worker a dead end. Use a real ⌘K, or nothing. */}
      <div className="hidden md:flex items-center">
        <Link
          href="/reception/search"
          className="group flex h-9 w-88 items-center gap-2.5 rounded-lg border border-border/80 bg-background/60 px-3.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          <span className="font-medium">ابحث برقم الطلب أو اسم العميل</span>
        </Link>
      </div>

      {/* Left (RTL End): User Pill. The old "متصل بالخادم" green pill was a
          hardcoded literal that never changed state — it read healthy even
          when the app had silently fallen back to polling on a stale feed.
          Transport health now lives with the one widget that actually knows
          it (NotificationBell), so the header makes no claim it cannot back. */}
      <div className="flex items-center gap-3">
        {bell}

        {/* User Identity Chip */}
        <div className="flex items-center gap-2.5 rounded-full border border-border/70 bg-card/60 p-1 ps-3.5">
          <div className="flex flex-col text-end">
            <span className="text-xs font-bold leading-tight text-foreground">
              {userName}
            </span>
            <span className="text-2xs font-semibold text-primary">
              {roleLabel}
            </span>
          </div>
          <div className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {userName.charAt(0) || "م"}
          </div>
        </div>
      </div>
    </header>
  );
}
