import { redirect } from "next/navigation";
import { getActor } from "~/server/auth";
import type { Actor as CoreActor } from "~/server/core";
import { asUserId } from "~/server/core";
import { db } from "~/server/db";

import { SidebarNav } from "./_components/sidebar-nav";
import { ShellHeader } from "./_components/shell-header";
import { SidebarUserCard } from "./_components/sidebar-user-card";

function getRoleLabel(roles: readonly string[]): string {
  if (roles.includes("ADMIN_OWNER")) return "مدير النظام";
  if (roles.includes("HEAD_DESIGNER")) return "رئيس قسم التصميم";
  if (roles.includes("DESIGNER")) return "مصمم";
  if (roles.includes("RECEPTION")) return "موظف استقبال";
  if (roles.includes("PRODUCTION_OPERATOR")) return "عامل إنتاج";
  if (roles.includes("ACCOUNTING")) return "محاسب مالي";
  if (roles.includes("PRINT_RECEPTION_DELIVERY")) return "مندوب توصيل";
  return "عضو فريق";
}

export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let actor;
  let isUnauthenticated = false;

  try {
    actor = await getActor();
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      err.name === "UnauthenticatedError"
    ) {
      isUnauthenticated = true;
    } else {
      throw err;
    }
  }

  if (isUnauthenticated || !actor) {
    redirect("/auth/required");
  }

  const coreActor: CoreActor = {
    userId: asUserId(actor.userId),
    roles: actor.roles,
    departmentIds: actor.departmentIds,
  };

  const user = await db.user.findUnique({
    where: { id: actor.userId },
    select: { name: true, username: true },
  });

  const roleLabel = getRoleLabel(actor.roles);

  return (
    <div className="relative flex min-h-screen flex-col bg-background selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      {/* Apple Aurora Atmospheric Ambient Mesh Canvas */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        {/* Soft Sapphire / Indigo Orb top-center */}
        <div className="apple-aurora-orb-1 absolute -top-[18%] start-[20%] h-[680px] w-[680px] rounded-full bg-gradient-to-br from-blue-500/12 via-indigo-500/6 to-transparent blur-[130px] dark:from-blue-600/15 dark:via-indigo-600/8" />
        {/* Soft Mint / Emerald Orb mid-right */}
        <div className="apple-aurora-orb-2 absolute top-[35%] end-[5%] h-[560px] w-[560px] rounded-full bg-gradient-to-bl from-teal-500/10 via-emerald-500/6 to-transparent blur-[120px] dark:from-teal-600/10 dark:via-emerald-600/6" />
        {/* Soft Violet / Pink Orb bottom-left */}
        <div className="apple-aurora-orb-3 absolute -bottom-[15%] start-[10%] h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-purple-500/10 via-pink-500/6 to-transparent blur-[140px] dark:from-purple-600/12 dark:via-pink-600/6" />
      </div>

      <ShellHeader
        userName={user?.name ?? "مستخدم برينتكس"}
        roleLabel={roleLabel}
      />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 border-e border-border/60 bg-card/65 backdrop-blur-2xl flex flex-col justify-between overflow-y-auto px-3 py-4 shadow-2xs">
          <SidebarNav actor={coreActor} />
          <SidebarUserCard
            userName={user?.name ?? "مستخدم برينتكس"}
            username={user?.username ?? "user"}
            roleLabel={roleLabel}
          />
        </aside>
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10">
          <div className="mx-auto max-w-7xl animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
