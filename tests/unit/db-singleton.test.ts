// T048 — Prisma singleton must be cached on globalThis in production too.
// Investigation §7.10: `globalForPrisma.prisma = db` was gated on
// NODE_ENV !== "production", so a second module evaluation in production
// constructed a fresh PrismaClient (latent double-client / doubled pools).
//
// Strategy: NODE_ENV="production" + vi.resetModules() + dynamic import twice.
// The strongest actually-runnable assertion is instance identity: after an
// unconditional global assignment, a module re-evaluation must pick up the
// client cached on globalThis instead of calling PrismaClient again.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type GlobalWithPrisma = { prisma?: unknown };
const g = globalThis as GlobalWithPrisma;
// Next.js types mark NODE_ENV readonly; mutate the runtime env through a
// structural cast instead (restored in afterEach).
const mutableEnv = process.env as Record<string, string | undefined>;

describe("src/server/db.ts production singleton (T048)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    delete g.prisma;
    mutableEnv.NODE_ENV = "production";
  });

  afterEach(() => {
    mutableEnv.NODE_ENV = originalNodeEnv;
    delete g.prisma;
    vi.resetModules();
  });

  it("assigns the client to globalThis unconditionally under production", async () => {
    const mod = await import("~/server/db");
    expect(process.env.NODE_ENV).toBe("production");
    expect(g.prisma).toBe(mod.db);
  });

  it("reuses the same client instance across module re-evaluations in production", async () => {
    const first = await import("~/server/db");
    vi.resetModules(); // wipe module registry only; globalThis.prisma persists
    const second = await import("~/server/db");
    expect(second.db).toBe(first.db);
    expect(g.prisma).toBe(first.db);
  });
});
