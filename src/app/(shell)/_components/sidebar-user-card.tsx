"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Loader2 } from "lucide-react";
import { authClient } from "~/server/better-auth/client";
import ar from "~/messages/ar.json";

interface SidebarUserCardProps {
  readonly userName?: string;
  readonly username?: string;
  readonly roleLabel?: string;
}

export function SidebarUserCard({
  userName = "مستخدم النظام",
  username = "user",
  roleLabel = "مسؤول",
}: SidebarUserCardProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await authClient.signOut();
      router.push("/login");
    } catch {
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="mt-auto border-t border-border/60 p-3 pt-4">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/50 bg-background/50 p-2.5 shadow-2xs backdrop-blur-md transition-all hover:bg-background/80 hover:shadow-xs">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/15 to-indigo-500/15 text-primary border border-primary/20 font-bold text-sm">
            {userName.charAt(0) || <UserIcon className="h-4 w-4" />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate text-xs font-semibold text-foreground">
              {userName}
            </span>
            <span className="truncate text-[10px] text-muted-foreground">
              {roleLabel} • @{username}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title={ar.ui.logout}
          aria-label={ar.ui.logout}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
