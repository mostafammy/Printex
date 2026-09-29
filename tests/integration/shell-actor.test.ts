// tests/integration/shell-actor.test.ts — T011 (092-performance, US2).
//
// AC-006 / FR-008..FR-012 / SEC-001: shell authentication stays
// authoritative and per-request while the duplicate display read is gone:
// (a) no session → UnauthenticatedError (layout converts to the
//     /auth/required redirect — asserted statically on the layout source,
//     since redirect() needs Next request context we do not harness here)
// (b) isActive=false with a live session → refused
// (c) Actor display fields (name/username) come from the ONE RBAC load
//     (FR-010) — the header fallback string is unchanged (FR-008)
// (d) layout source no longer issues a display-user query at all
//
// Deeper authz matrix stays in tests/integration/getActor.test.ts (001).

import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { testDb } from "../helpers/testDb";
import {
  getActorForSession,
  UnauthenticatedError,
} from "~/server/auth/getActor";

afterAll(async () => {
  await testDb.$disconnect();
});

let _counter = 0;
function unique(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

async function seedShellUser(opts?: { isActive?: boolean }): Promise<{
  userId: string;
  expiresAt: Date;
  name: string;
  username: string;
}> {
  const id = unique("shelluser");
  const name = "مستخدم برينتكس Test";
  await testDb.user.create({
    data: {
      id,
      name,
      email: `${id}@example.test`,
      username: id,
      isActive: opts?.isActive ?? true,
    },
  });
  return { userId: id, expiresAt: new Date(Date.now() + 60_000), name, username: id };
}

describe("shell actor resolution (T011)", () => {
  it("(a) no session throws UnauthenticatedError — the layout's redirect source is present (AC-006)", async () => {
    await expect(getActorForSession(null)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );

    const layout = readFileSync(
      resolve(process.cwd(), "src/app/(shell)/layout.tsx"),
      "utf8",
    );
    expect(layout).toContain('redirect("/auth/required")');
    expect(layout).toContain("UnauthenticatedError");
  });

  it("(b) isActive=false with a live session is refused (SEC-001, FR-009)", async () => {
    const seeded = await seedShellUser({ isActive: false });
    await expect(
      getActorForSession({
        userId: seeded.userId,
        expiresAt: seeded.expiresAt,
      }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("(c) Actor carries name/username from the same RBAC load; header fallback unchanged (FR-008, FR-010)", async () => {
    const seeded = await seedShellUser();
    const actor = await getActorForSession({
      userId: seeded.userId,
      expiresAt: seeded.expiresAt,
    });

    expect(actor.userId).toBe(seeded.userId);
    expect(actor.name).toBe(seeded.name);
    expect(actor.username).toBe(seeded.username);

    const layout = readFileSync(
      resolve(process.cwd(), "src/app/(shell)/layout.tsx"),
      "utf8",
    );
    // Same Arabic fallback as before the change (FR-008).
    expect(layout).toContain('actor.name ?? "مستخدم برينتكس"');
  });

  it("(d) the shell layout issues NO display-user query and getActor uses the shared session cache (FR-008, FR-012)", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "src/app/(shell)/layout.tsx"),
      "utf8",
    );
    // The duplicate read is gone entirely — not merely reordered.
    expect(layout).not.toContain("db.user.findUnique");
    expect(layout).not.toContain('select: { name: true, username: true }');

    const getActorSource = readFileSync(
      resolve(process.cwd(), "src/server/auth/getActor.ts"),
      "utf8",
    );
    // Single shared session cache (T015): no direct auth.api bypass.
    expect(getActorSource).toContain("getSession()");
    expect(getActorSource).not.toContain("auth.api.getSession");
  });
});
