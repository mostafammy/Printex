"use client";

import React from "react";
import Link from "next/link";
import {
  Printer,
  Sparkles,
  Search,
  Command,
} from "lucide-react";
import ar from "~/messages/ar.json";

interface ShellHeaderProps {
  readonly userName?: string;
  readonly roleLabel?: string;
}

export function ShellHeader({
  userName = "مستخدم النظام",
  roleLabel = "مسؤول",
}: ShellHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border/70 bg-card/70 px-4 sm:px-6 backdrop-blur-2xl shadow-xs">
      {/* Brand Identity / App Emblem */}
      <div className="flex items-center gap-3">
        <Link
          href="/my-queue"
          className="group flex items-center gap-3 transition-transform duration-200 active:scale-95"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary via-blue-600 to-indigo-600 text-primary-foreground shadow-md shadow-primary/30 transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/40">
            <Printer className="h-5 w-5" />
            <Sparkles className="absolute -top-1 -end-1 h-3.5 w-3.5 text-amber-300 animate-pulse drop-shadow-xs" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-foreground leading-none">
              {ar.ui.appName}
            </span>
            <span className="text-[10px] text-muted-foreground font-semibold mt-0.5 tracking-tight">
              نظام إدارة المطابع الذكي
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Apple-style Command / Search Pill (Spotlight) */}
      <div className="hidden md:flex items-center">
        <Link
          href="/reception/search"
          className="group flex h-9.5 w-88 items-center justify-between rounded-full border border-border/80 bg-background/50 px-4 py-1.5 text-xs text-muted-foreground shadow-2xs backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-primary/50 hover:bg-card/90 hover:shadow-[0_0_24px_rgba(0,113,227,0.15)] hover:text-foreground"
        >
          <div className="flex items-center gap-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:scale-110 group-hover:text-primary" />
            <span className="font-medium">بحث سريع في الطلبات والعملاء...</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/60 px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </div>
        </Link>
      </div>

      {/* Left (RTL End): Live Status + User Pill */}
      <div className="flex items-center gap-3">
        {/* Live System Indicator */}
        <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px]">متصل بالخادم</span>
        </div>

        {/* User Identity Chip */}
        <div className="flex items-center gap-2.5 rounded-full border border-border/70 bg-card/60 p-1 ps-3.5 shadow-2xs backdrop-blur-md transition-all duration-200 hover:border-primary/30 hover:bg-card">
          <div className="flex flex-col text-end">
            <span className="text-xs font-bold text-foreground leading-tight">
              {userName}
            </span>
            <span className="text-[10px] font-semibold text-primary">
              {roleLabel}
            </span>
          </div>
          <div className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-indigo-600 text-xs font-bold text-white shadow-xs shadow-primary/30">
            {userName.charAt(0) || "م"}
          </div>
        </div>
      </div>
    </header>
  );
}
