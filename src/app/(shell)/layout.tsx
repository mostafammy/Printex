import { redirect } from "next/navigation";
import { getActor } from "~/server/auth";
import type { Actor as CoreActor } from "~/server/core";
import { asUserId } from "~/server/core";
import { db } from "~/server/db";

import { ShellHeader } from "./_components/shell-header";
import { IconRail } from "~/components/shell/IconRail";
import { CommandBar } from "~/components/shell/CommandBar";

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
      {/* Subtle single gradient mesh background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-radial from-muted/30 to-background"
      />

      <ShellHeader
        userName={user?.name ?? "مستخدم برينتكس"}
        roleLabel={roleLabel}
      />
      <div className="flex flex-1 overflow-hidden">
        <IconRail actor={coreActor} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <CommandBar />
    </div>
  );
}
