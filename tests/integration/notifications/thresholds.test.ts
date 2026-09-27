// US5: threshold configuration and recipient overrides.
//
// Two failure modes are being ruled out here, and they are the ones a shop
// would actually hit:
//
//   1. a configuration value that references something which does not exist
//      (a role, a permission, a department) being stored anyway and then
//      silently alerting nobody — constitution VI requires it be a
//      VALIDATION error, not a dormant row;
//   2. an override that REMOVES a recipient instead of adding one, which
//      would let a stray Admin edit mute the notifications the business
//      depends on (FR-017).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../helpers/testDb";
import {
  authorizationCode,
  clearRecipientOverride,
  processOutboxBatch,
  recipientOverride,
  schedulerStatus,
  setRecipientOverride,
  updateThreshold,
} from "~/server/notifications";
import { recordOutboxEvent, seedDepartment, seedNotificationUser } from "../../helpers/notificationSeed";

afterAll(async () => {
  // An override is GLOBAL configuration: it changes the recipient set for
  // every later test that processes this type. Leaving it behind made
  // processorIdempotency and outboxBackfill fail depending on file order,
  // which is exactly the kind of coupling that turns a green suite red on an
  // unrelated change. Cleared here, so this file's configuration does not
  // leak out of it.
  await testDb.notificationTypeOverride.deleteMany({});
  await testDb.$disconnect();
});

let admin: Awaited<ReturnType<typeof seedNotificationUser>>;
let designer: Awaited<ReturnType<typeof seedNotificationUser>>;
let departmentId: string;

beforeAll(async () => {
  // Both the ROLE and the permissions. The override below addresses
  // `roles: ["ADMIN_OWNER"]`, and role addressing resolves through UserRole —
  // a user carrying only the `admin.config` PERMISSION would correctly
  // receive nothing, and the union test would fail for the wrong reason.
  admin = await seedNotificationUser({
    prefix: "threshold-admin",
    roleKeys: ["ADMIN_OWNER"],
    permissions: ["admin.config", "audit.view"],
  });
  designer = await seedNotificationUser({ prefix: "threshold-designer" });
  departmentId = await seedDepartment("threshold-dept");
});

/**
 * Asserts a call fails with `code`.
 *
 * `authorizationCode` rather than `instanceof DomainNotificationError`,
 * because a permission refusal comes from 001's `authorize()` — which throws
 * its own `ForbiddenError` — while a validation failure is 053's. Both are
 * FORBIDDEN as far as a caller switching on the code is concerned, and the
 * contract promises exactly that. Asserting on the class instead would pin
 * the test to an implementation detail and would have hidden the question of
 * whether the code a UI switches on is actually reachable.
 */
async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeDefined();
  const caught = await promise.catch((error: unknown) => error);
  expect(authorizationCode(caught)).toBe(code);
}

describe("threshold validation (T053 / US5 scenario 5)", () => {
  it("refuses an unknown role, permission, and department", async () => {
    await expectCode(
      updateThreshold(admin, {
        phase: "REVIEW",
        thresholdMinutes: 60,
        alertRoles: ["NOT_A_ROLE"],
        reason: "validation probe",
      }),
      "UNKNOWN_ROLE",
    );

    await expectCode(
      updateThreshold(admin, {
        phase: "REVIEW",
        thresholdMinutes: 60,
        alertPermissions: ["not.a.permission"],
        reason: "validation probe",
      }),
      "UNKNOWN_PERMISSION",
    );

    await expectCode(
      updateThreshold(admin, {
        phase: "REVIEW",
        thresholdMinutes: 60,
        alertDepartmentIds: ["no-such-department"],
        reason: "validation probe",
      }),
      "UNKNOWN_DEPARTMENT",
    );
  });

  it("refuses a non-positive threshold and a non-increasing escalation", async () => {
    await expectCode(
      updateThreshold(admin, { phase: "REVIEW", thresholdMinutes: 0, reason: "probe" }),
      "INVALID_THRESHOLD",
    );
    await expectCode(
      updateThreshold(admin, { phase: "REVIEW", thresholdMinutes: -30, reason: "probe" }),
      "INVALID_THRESHOLD",
    );
    // FR-047: an escalation at or below the base threshold would fire the
    // instant the base alert does, and so would mean nothing.
    await expectCode(
      updateThreshold(admin, {
        phase: "REVIEW",
        thresholdMinutes: 60,
        escalationMinutes: 60,
        reason: "probe",
      }),
      "INVALID_ESCALATION",
    );
    await expectCode(
      updateThreshold(admin, {
        phase: "REVIEW",
        thresholdMinutes: 60,
        escalationMinutes: 30,
        reason: "probe",
      }),
      "INVALID_ESCALATION",
    );
  });

  it("refuses an escalation on a DISABLED phase (FR-047)", async () => {
    // A tier above a threshold that does not exist has nothing to sit above.
    await expectCode(
      updateThreshold(admin, {
        phase: "COLLECTION",
        thresholdMinutes: null,
        escalationMinutes: 120,
        reason: "probe",
      }),
      "INVALID_ESCALATION",
    );
  });

  it("requires a reason, and a refused write stores NOTHING and writes no audit", async () => {
    const before = await testDb.auditEvent.count({
      where: { action: "notification.threshold_updated", entityId: "DESIGN" },
    });
    const rowBefore = await testDb.delayThreshold.findUnique({ where: { phase: "DESIGN" } });

    await expectCode(
      updateThreshold(admin, { phase: "DESIGN", thresholdMinutes: 999, reason: "   " }),
      "EMPTY_REASON",
    );

    // FR-062: a refused action writes no audit event.
    const after = await testDb.auditEvent.count({
      where: { action: "notification.threshold_updated", entityId: "DESIGN" },
    });
    expect(after).toBe(before);

    // ...and the row is unchanged.
    const rowAfter = await testDb.delayThreshold.findUnique({ where: { phase: "DESIGN" } });
    expect(rowAfter?.thresholdMinutes).toBe(rowBefore?.thresholdMinutes);
  });

  it("accepts a valid change and audits it with the reason", async () => {
    // Seed the prior row first. The migration normally guarantees five
    // threshold rows exist, but `prisma db push` (which the test database
    // uses) does not run migration seed inserts, and the reset script
    // truncates the table — so without this the upsert CREATES the row, the
    // audit's `before` snapshot is null, and a "snapshots, not diffs"
    // assertion fails for a reason that has nothing to do with the feature.
    // Seeding here mirrors production, where an Admin edit always has a
    // previous row to snapshot.
    await testDb.delayThreshold.upsert({
      where: { phase: "DESIGN" },
      create: {
        phase: "DESIGN",
        thresholdMinutes: 240,
        alertRoles: ["HEAD_DESIGNER"],
        alertPermissions: ["design.work"],
        alertDepartmentIds: [],
        escalationMinutes: null,
        updatedById: null,
      },
      update: {
        thresholdMinutes: 240,
        alertRoles: ["HEAD_DESIGNER"],
        alertPermissions: ["design.work"],
        alertDepartmentIds: [],
        escalationMinutes: null,
      },
    });

    const view = await updateThreshold(admin, {
      phase: "DESIGN",
      thresholdMinutes: 200,
      alertRoles: ["HEAD_DESIGNER"],
      reason: "shorter design window for the summer rush",
    });
    expect(view.thresholdMinutes).toBe(200);
    expect(view.thresholdInput).toBe("3h20m");

    // Scoped to this run's actor: `unique()` makes the fixture user's id
    // unrepeatable, so this reads back the event this call wrote regardless
    // of what earlier runs left in the shared database.
    const event = await testDb.auditEvent.findFirstOrThrow({
      where: {
        action: "notification.threshold_updated",
        entityId: "DESIGN",
        actorId: admin.userId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(event.reason).toBe("shorter design window for the summer rush");
    // Snapshots, not diffs (001's convention), and a real PREVIOUS row —
    // which is why the upsert above exists.
    expect(event.before).not.toBeNull();
    expect(event.after).not.toBeNull();
    // The change is visible in the snapshots, not merely recorded as happened.
    expect(event.before).toMatchObject({ thresholdMinutes: 240 });
    expect(event.after).toMatchObject({ thresholdMinutes: 200 });
  });

  it("refuses a non-admin (US5 scenario 4)", async () => {
    await expectCode(
      updateThreshold(designer, { phase: "REVIEW", thresholdMinutes: 30, reason: "probe" }),
      "FORBIDDEN",
    );
  });

  it("schedulerStatus is admin-gated and reports the unmapped counter (FR-019)", async () => {
    await expectCode(schedulerStatus(designer), "FORBIDDEN");

    await recordOutboxEvent({
      type: "totally.unknown.event",
      entityId: "unmapped-probe",
      deliveryStatus: "UNMAPPED",
    });
    const status = await schedulerStatus(admin);
    expect(status.unmappedTypes.some((row) => row.type === "totally.unknown.event")).toBe(true);
    expect(status.intervalMinutes).toBeGreaterThan(0);
  });
});

describe("recipient override (T077 / FR-017)", () => {
  it("UNIONS with the catalog default rather than replacing it (FR-017)", async () => {
    // The catalog entry addresses `payload.assigneeId`. An override that omits
    // that MUST NOT remove it — the safety property is that a bad Admin edit
    // can only ever ADD recipients.
    const eventId = await recordOutboxEvent({
      type: "workitem.rejected",
      entityId: "override-union",
      recipientUserIds: [designer.userId],
      payload: { assigneeId: designer.userId },
    });

    await setRecipientOverride(admin, {
      type: "workitem.rejected",
      roles: ["ADMIN_OWNER"],
      reason: "also tell the owner",
    });

    // The override is stored under the CANONICAL type, so a lookup by the
    // alias 013/014 actually use still finds it.
    const stored = await recipientOverride("work_item.rejected");
    expect(stored?.roles).toEqual(["ADMIN_OWNER"]);

    await processOutboxBatch();

    const rows = await testDb.notification.findMany({ where: { sourceEventId: eventId } });
    // The designer, addressed by the payload, is still notified.
    expect(rows.some((r) => r.userId === designer.userId)).toBe(true);
    // And the Admin, addressed by the override, is now notified too.
    expect(rows.some((r) => r.userId === admin.userId)).toBe(true);
  });

  it("refuses an override for a type with no catalog entry (dormant row)", async () => {
    await expectCode(
      setRecipientOverride(admin, {
        type: "no.such.event",
        roles: ["ADMIN_OWNER"],
        reason: "probe",
      }),
      "UNKNOWN_EVENT_TYPE",
    );
    // Nothing stored: a row nothing will ever read is a configuration lie.
    expect(
      await testDb.notificationTypeOverride.count({ where: { type: "no.such.event" } }),
    ).toBe(0);
  });

  it("requires a reason, validates the arrays, and is admin-gated", async () => {
    await expectCode(
      setRecipientOverride(admin, { type: "workitem.assigned", roles: ["ADMIN_OWNER"], reason: "" }),
      "EMPTY_REASON",
    );
    await expectCode(
      setRecipientOverride(admin, {
        type: "workitem.assigned",
        roles: ["NOT_A_ROLE"],
        reason: "probe",
      }),
      "UNKNOWN_ROLE",
    );
    await expectCode(
      setRecipientOverride(designer, { type: "workitem.assigned", roles: [], reason: "probe" }),
      "FORBIDDEN",
    );
  });

  it("clearRecipientOverride restores the default and audits the deletion", async () => {
    await setRecipientOverride(admin, {
      type: "workitem.assigned",
      departmentIds: [departmentId],
      reason: "tell the department too",
    });
    expect(await recipientOverride("workitem.assigned")).not.toBeNull();

    await clearRecipientOverride(admin, "workitem.assigned", "reverted: too noisy");

    // The row is gone — the only DELETE in 053, and it deletes CONFIGURATION.
    expect(await recipientOverride("workitem.assigned")).toBeNull();
    expect(
      await testDb.notificationTypeOverride.count({ where: { type: "workitem.assigned" } }),
    ).toBe(0);

    // The audit trail of that deletion survives, which is the point: clearing
    // configuration must not erase the record that it was changed.
    const event = await testDb.auditEvent.findFirstOrThrow({
      where: { action: "notification.recipient_override_updated", entityId: "workitem.assigned" },
      orderBy: { createdAt: "desc" },
    });
    expect(event.reason).toBe("reverted: too noisy");
    expect(event.before).not.toBeNull();
  });

  it("clearing a non-existent override is a no-op success, not an error", async () => {
    await expect(
      clearRecipientOverride(admin, "workitem.production_file_revised", "nothing to clear"),
    ).resolves.toBeUndefined();
  });
});
