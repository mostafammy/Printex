import { db } from "~/server/db";

const actorNameCache = new Map<string, { name: string; expiresAt: number }>();

export async function resolveActorName(actorId: string): Promise<string> {
  const cached = actorNameCache.get(actorId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.name;
  }

  try {
    const user = await db.user.findUnique({
      where: { id: actorId },
      select: { name: true },
    });
    const name = user?.name ?? "مستخدم";
    actorNameCache.set(actorId, { name, expiresAt: now + 60000 });
    return name;
  } catch {
    return "مستخدم";
  }
}
