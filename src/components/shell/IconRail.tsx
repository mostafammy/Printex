"use client";

/**
 * IconRail: narrow navigation rail replacing the wide sidebar with ink markers and tooltips.
 * (specs/017-press-floor-board/spec.md FR-033, research.md R11, plan.md S1)
 */

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  CheckCircle2,
  Clock,
  Kanban,
  Printer,
  ReceiptText,
  Search,
  Users,
} from "lucide-react";
import type { Actor } from "~/server/core";

export interface IconRailProps {
  readonly actor: Actor;
  readonly onOpenCommandBar?: () => void;
}

interface RailItem {
  readonly id: string;
  readonly href: string;
  readonly labelAr: string;
  readonly icon: React.ReactNode;
  readonly inkToken?: string;
  readonly roles?: readonly string[];
}

const RAIL_ITEMS: readonly RailItem[] = [
  {
    id: "board",
    href: "/board",
    labelAr: "لوحة أرضية المطبعة",
    icon: <Kanban className="h-5 w-5" />,
    inkToken: "var(--ink-cyan)",
  },
  {
    id: "production",
    href: "/production",
    labelAr: "صالة الإنتاج والطباعة",
    icon: <Printer className="h-5 w-5" />,
    inkToken: "var(--ink-cyan)",
  },
  {
    id: "pricing",
    href: "/pricing",
    labelAr: "التسعير والمالية",
    icon: <Calculator className="h-5 w-5" />,
    inkToken: "var(--ink-yellow)",
  },
  {
    id: "accounting-orders",
    href: "/accounting/orders",
    labelAr: "طلبات وسجل المحاسب",
    icon: <ReceiptText className="h-5 w-5" />,
    inkToken: "var(--ink-orange)",
    roles: ["ACCOUNTING", "ADMIN_OWNER"],
  },
  {
    id: "my-queue",
    href: "/my-queue",
    labelAr: "قائمتي",
    icon: <Clock className="h-5 w-5" />,
    inkToken: "var(--ink-key)",
  },
  {
    id: "customers",
    href: "/customers",
    labelAr: "العملاء",
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: "review",
    href: "/review",
    labelAr: "المراجعة",
    icon: <CheckCircle2 className="h-5 w-5" />,
    inkToken: "var(--ink-violet)",
  },
];

function RailLink({ item, pathname }: { readonly item: RailItem; readonly pathname: string }) {
  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
  return (
    <Link
      href={item.href}
      title={item.labelAr}
      aria-label={item.labelAr}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all ${
        isActive
          ? "bg-primary/10 text-primary shadow-2xs"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {item.inkToken ? (
        <span
          className="absolute start-1 top-2 bottom-2 w-0.5 rounded-full"
          style={{ backgroundColor: item.inkToken }}
          aria-hidden="true"
        />
      ) : null}
      {item.icon}
    </Link>
  );
}

export function IconRail({ actor, onOpenCommandBar }: IconRailProps) {
  const pathname = usePathname();

  const visibleItems = RAIL_ITEMS.filter(
    (item) => !item.roles || item.roles.length === 0 || item.roles.some((r) => actor.roles.includes(r))
  );

  return (
    <nav
      aria-label="شريط التنقل الجانبي"
      className="flex w-16 shrink-0 flex-col items-center justify-between border-e border-border/60 bg-card/65 py-4 backdrop-blur-md"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-xs">
          PT
        </div>

        <button
          type="button"
          onClick={onOpenCommandBar}
          className="group relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="فتح شريط البحث والأوامر (⌘K)"
          title="بحث (⌘K)"
        >
          <Search className="h-4 w-4" />
        </button>

        <div className="my-1 h-px w-8 bg-border/60" />

        {visibleItems.map((item) => (
          <RailLink key={item.id} item={item} pathname={pathname} />
        ))}
      </div>
      {/* 092 T042 / FR-031: the dead /settings rail link (no such route)
          was removed with its now-empty wrapper — never a silent 404. */}
    </nav>
  );
}
