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
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border/60 bg-card/80 px-4 sm:px-6 backdrop-blur-xl">
      {/* Brand Identity / App Emblem */}
      <div className="flex items-center gap-3">
        <Link
          href="/my-queue"
          className="group flex items-center gap-2.5 transition-transform duration-200 active:scale-95"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground shadow-sm shadow-primary/25 transition-transform duration-300 group-hover:scale-105">
            <Printer className="h-5 w-5" />
            <Sparkles className="absolute -top-1 -end-1 h-3.5 w-3.5 text-amber-300 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-foreground leading-none">
              {ar.ui.appName}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
              نظام إدارة المطابع الذكي
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Apple-style Command / Search Pill */}
      <div className="hidden md:flex items-center">
        <Link
          href="/reception/search"
          className="group flex h-9 w-80 items-center justify-between rounded-full border border-border/80 bg-background/60 px-3.5 py-1.5 text-xs text-muted-foreground shadow-2xs backdrop-blur-md transition-all duration-200 hover:border-primary/40 hover:bg-background hover:text-foreground"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span>بحث سريع في الطلبات والعملاء...</span>
          </div>
          <div className="flex items-center gap-0.5 rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </div>
        </Link>
      </div>

      {/* Left (RTL End): Live Status + Notifications + User Pill */}
      <div className="flex items-center gap-3">
        {/* Live System Indicator */}
        <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold">متصل</span>
        </div>

        {/* User Identity Chip */}
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 p-1 ps-3 shadow-2xs">
          <div className="flex flex-col text-end">
            <span className="text-xs font-semibold text-foreground leading-tight">
              {userName}
            </span>
            <span className="text-[10px] font-medium text-primary">
              {roleLabel}
            </span>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-primary/20 to-indigo-500/20 text-xs font-bold text-primary border border-primary/20">
            {userName.charAt(0) || "م"}
          </div>
        </div>
      </div>
    </header>
  );
}
