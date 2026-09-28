// T019 / SC-004: the four addressing modes resolve correctly, and a user
// reached by TWO modes gets ONE notification.
//
// Each mode joins a different table — explicit ids to User, roles through
// UserRole, departments through UserDepartment, permissions through
// RolePermission ∪ UserPermission — so each needs its own proof: a bug that
// dropped one join would produce a silent under-notification for exactly
// the events addressed that way.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import { processOutboxBatch, resolveRecipients } from "~/server/notifications";
import { recordOutboxEvent, seedDepartment, seedNotificationUser } from "../../helpers/notificationSeed";

afterAll(async () => {
  await testDb.$disconnect();
});

let designer: Awaited<ReturnType<typeof seedNotificationUser>>;
let headDesigner: Awaited<ReturnType<typeof seedNotificationUser>>;
let receptionist: Awaited<ReturnType<typeof seedNotificationUser>>;
let departmentId: string;

beforeAll(async () => {
  departmentId = await seedDepartment("resolution-dept");
  designer = await seedNotificationUser({ prefix: "resolve-designer" });
  // The permission grant goes through UserPermission (the per-user extra),
  // so mode 4 is exercised on ITS table rather than riding on a role.
  headDesigner = await seedNotificationUser({
    prefix: "resolve-head",
    permissions: ["design.review"],
  });
  receptionist = await seedNotificationUser({
    prefix: "resolve-reception",
    roleKeys: ["RECEPTION"],
    departmentIds: [departmentId],
  });
});

describe("four addressing modes (T019 / SC-004)", () => {
  it("mode 1: explicit user ids resolve to active users only", async () => {
    const resolved = await resolveRecipients({ userIds: [designer.userId, "ghost-user"] });
    // A ghost id contributes nothing rather than throwing — an unknown
    // recipient must never break an unrelated feature's delivery (contract
    // §3).
    expect([...resolved]).toEqual([designer.userId]);
  });

  it("mode 2: roles resolve through UserRole", async () => {
    const resolved = await resolveRecipients({ roles: ["RECEPTION"] });
    expect(resolved.has(receptionist.userId)).toBe(true);
    expect(resolved.has(designer.userId)).toBe(false);
  });

  it("mode 3: departments resolve through UserDepartment", async () => {
    const resolved = await resolveRecipients({ departmentIds: [departmentId] });
    expect(resolved.has(receptionist.userId)).toBe(true);
    expect(resolved.has(designer.userId)).toBe(false);
  });

  it("mode 4: permissions resolve through UserPermission", async () => {
    // `headDesigner` holds design.review ONLY as a per-user grant — no role
    // carries it. Passing that resolution would fail if mode 4 joined the
    // role tables instead.
    const resolved = await resolveRecipients({ permissions: ["design.review"] });
    expect(resolved.has(headDesigner.userId)).toBe(true);
    expect(resolved.has(designer.userId)).toBe(false);
  });

  it("a deactivated user is excluded from EVERY mode", async () => {
    // Held by every mode FIRST — otherwise each branch below would pass
    // vacuously against a user who was never addressable in the first
    // place.
    const gone = await seedNotificationUser({
      prefix: "resolve-deactivated",
      roleKeys: ["RECEPTION"],
      permissions: ["design.review"],
      departmentIds: [departmentId],
    });
    await testDb.user.update({ where: { id: gone.userId }, data: { isActive: false } });

    const specs = [
      { userIds: [gone.userId] },
      { roles: ["RECEPTION"] },
      { departmentIds: [departmentId] },
      { permissions: ["design.review"] },
    ];
    for (const spec of specs) {
      const resolved = await resolveRecipients(spec);
      expect(resolved.has(gone.userId), `mode leaked a deactivated user: ${JSON.stringify(spec)}`).toBe(
        false,
      );
    }

    // And the same four specs DO reach an active user — proving the specs
    // themselves are addressable, so the exclusions above are about
    // isActive and nothing else. Mode 1 needs the active id added explicitly
    // (its spec addressed only the deactivated user).
    const addressable = [
      { userIds: [gone.userId, designer.userId] },
      { roles: ["RECEPTION"] },
      { departmentIds: [departmentId] },
      { permissions: ["design.review"] },
    ];
    for (const spec of addressable) {
      const resolved = await resolveRecipients(spec);
      expect(resolved.size).toBeGreaterThan(0);
    }
  });

  it("empty and unknown specs resolve to nobody, never an error", async () => {
    expect((await resolveRecipients({})).size).toBe(0);
    expect((await resolveRecipients({ roles: ["NOT_A_ROLE"] })).size).toBe(0);
    expect((await resolveRecipients({ permissions: ["nope.nope"] })).size).toBe(0);
  });
});

describe("two modes, one notification (T019 / SC-004)", () => {
  it("a user reachable by BOTH the event and the catalog gets exactly one", async () => {
    // receptionist matches BOTH `recipientRoles: ["RECEPTION"]` on the
    // outbox row AND the catalog's role default — the dedup case.
    const eventId = await recordOutboxEvent({
      type: "order.ready_for_collection",
      entityType: "Order",
      entityId: "resolution-union-order",
      recipientRoles: ["RECEPTION"],
      payload: { orderId: "resolution-union-order" },
    });

    await processOutboxBatch();

    const rows = await testDb.notification.findMany({
      where: { sourceEventId: eventId, userId: receptionist.userId },
    });
    // The @@unique pair is the floor; the resolver's dedup is what keeps
    // the insert from ever being the thing that has to catch it.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe("order.ready_for_collection");
  });

  it("a ZERO-audience event (RECORDED_ONLY) still drains as PROCESSED (FR-064)", async () => {
    // The one catalog entry whose audience is genuinely empty: the recipient
    // is the CUSTOMER, not a user — 054 reads the same outbox row for the
    // customer-facing message. 053 must mark it processed so the outbox
    // drains, create no internal notification, and NOT call it unmapped:
    // the type is known, its audience is deliberately empty (FR-064).
    //
    // (`order.ready_for_collection` cannot demonstrate "zero resolved" here
    // — its CATALOG default addresses RECEPTION, and union semantics mean
    // that default is added even when the event row's own role resolves to
    // nobody. That union behaviour is asserted in thresholds.test.ts.)
    const eventId = await recordOutboxEvent({
      type: "customer.ready_for_collection",
      entityType: "Order",
      entityId: "resolution-empty-order",
      payload: { orderId: "resolution-empty-order" },
    });

    await processOutboxBatch();

    const event = await testDb.notificationEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.deliveryStatus).toBe("PROCESSED");
    expect(event.deliveredAt).not.toBeNull();
    expect(await testDb.notification.count({ where: { sourceEventId: eventId } })).toBe(0);
  });
});
