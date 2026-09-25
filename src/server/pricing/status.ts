import type { Prisma } from "../../../generated/prisma";
import { err, ok, type Result } from "~/server/core";
import { db } from "~/server/db";
import { DomainPricingError } from "./errors";

export type PricingStatusValue = "PENDING" | "PRICED" | "DISPUTED";

export type PricingStatusSnapshot = {
  readonly workItemId: string;
  readonly status: PricingStatusValue;
  readonly waitingSince: Date | null;
  readonly disputeReason: string | null;
  readonly currentPriceId: string | null;
  readonly updatedById: string | null;
  readonly updatedAt: Date;
};

export type PricingStatusMutation = {
  readonly workItemId: string;
  readonly status: PricingStatusValue;
  readonly waitingSince?: Date | null;
  readonly disputeReason?: string | null;
  readonly currentPriceId?: string | null;
  readonly updatedById?: string | null;
};

type PricingStatusClient = Pick<Prisma.TransactionClient, "pricingStatus">;

export async function persistPricingStatus(
  tx: PricingStatusClient,
  mutation: PricingStatusMutation,
): Promise<void> {
  const existing = await tx.pricingStatus.findUnique({
    where: { workItemId: mutation.workItemId },
    select: { waitingSince: true },
  });

  // waitingSince semantics (data-model.md): set on entry to PENDING, retained
  // while the status is unresolved (PENDING or DISPUTED), cleared once a valid
  // current price exists (PRICED).
  const waitingSince =
    mutation.status === "PRICED"
      ? null
      : mutation.waitingSince ?? existing?.waitingSince ?? new Date();

  await tx.pricingStatus.upsert({
    where: { workItemId: mutation.workItemId },
    create: {
      workItemId: mutation.workItemId,
      status: mutation.status,
      waitingSince,
      disputeReason: mutation.disputeReason ?? null,
      currentPriceId: mutation.currentPriceId ?? null,
      updatedById: mutation.updatedById ?? null,
    },
    update: {
      status: mutation.status,
      waitingSince,
      disputeReason: mutation.disputeReason ?? null,
      currentPriceId: mutation.currentPriceId ?? null,
      updatedById: mutation.updatedById ?? null,
    },
  });
}

export async function readPricingStatus(workItemId: string): Promise<PricingStatusSnapshot | null> {
  return db.pricingStatus.findUnique({ where: { workItemId } });
}

export async function readPendingSince(workItemId: string): Promise<Date | null> {
  const pricingStatus = await db.pricingStatus.findUnique({
    where: { workItemId },
    select: { waitingSince: true, status: true },
  });

  // Unresolved covers both PENDING and DISPUTED (FR-011) — 053's delay
  // alerts must keep seeing the original waiting timestamp while a dispute
  // is open.
  return pricingStatus && pricingStatus.status !== "PRICED"
    ? pricingStatus.waitingSince
    : null;
}

/**
 * Current-spec validity for one already-loaded WorkItemPrice row.
 *
 * A price only counts as current when it still exists, still belongs to the
 * Work Item being queried, has not been superseded (`replacedAt`), and was
 * produced under the Work Item's current specification. 016 does not yet
 * publish a spec fingerprint on WorkItem, so the fingerprint comparison
 * degenerates to "no fingerprint recorded" until that contract lands; once it
 * does, `specFingerprint` on the price row is the stale-spec check
 * (`STALE_SPEC_VERSION`).
 */
export function isCurrentPriceRow(
  price: { workItemId: string; replacedAt: Date | null; specFingerprint: string | null } | null,
  workItemId: string,
): boolean {
  if (!price) return false;
  if (price.workItemId !== workItemId) return false;
  if (price.replacedAt !== null) return false;
  return true;
}

/**
 * Batched variant of {@link isCurrentPriceRow}: loads every candidate
 * `currentPriceId` once and returns the subset that is still valid for its
 * owning Work Item. Used by `status()` and the 015 delivery gate so both
 * resolve current-spec validity identically.
 */
type PriceReadClient = Pick<Prisma.TransactionClient, "workItemPrice">;

export async function findValidCurrentPriceIds(
  candidates: readonly { readonly workItemId: string; readonly currentPriceId: string | null }[],
  client: PriceReadClient = db,
): Promise<ReadonlySet<string>> {
  const priceIds = [...new Set(
    candidates.flatMap((candidate) => candidate.currentPriceId ? [candidate.currentPriceId] : []),
  )];
  if (priceIds.length === 0) return new Set();

  const prices = await client.workItemPrice.findMany({
    where: { id: { in: priceIds } },
    select: { id: true, workItemId: true, replacedAt: true, specFingerprint: true },
  });
  const byId = new Map(prices.map((price) => [price.id, price]));

  const valid = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.currentPriceId) continue;
    const price = byId.get(candidate.currentPriceId) ?? null;
    if (isCurrentPriceRow(price, candidate.workItemId)) valid.add(candidate.currentPriceId);
  }
  return valid;
}

/**
 * Active users who can act on unresolved pricing — resolved through 001's
 * permission vocabulary (role grants plus per-user extras), never by a local
 * role-name guess.
 */
export type ResponsiblePricingUsers = {
  readonly label: string;
  readonly userIds: readonly string[];
};

const RESPONSIBLE_PERMISSIONS = [
  "pricing.use_fixed",
  "pricing.set_variable",
  "pricing.override",
] as const;

export async function resolveResponsiblePricingUsers(
  client: Pick<Prisma.TransactionClient, "user"> = db,
): Promise<ResponsiblePricingUsers> {
  const users = await client.user.findMany({
    where: {
      isActive: true,
      OR: [
        { roles: { some: { role: { permissions: { some: { permission: { in: [...RESPONSIBLE_PERMISSIONS] } } } } } } },
        { extraPermissions: { some: { permission: { in: [...RESPONSIBLE_PERMISSIONS] } } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (users.length === 0) {
    return { label: "Pricing review required", userIds: [] };
  }
  const names = users.slice(0, 5).map((user) => user.name);
  const overflow = users.length > names.length ? ` (+${users.length - names.length} more)` : "";
  return {
    label: `${names.join(", ")}${overflow}`,
    userIds: users.map((user) => user.id),
  };
}

export async function status(workItemId: string): Promise<Result<PricingStatusSnapshot, DomainPricingError>> {
  const snapshot = await readPricingStatus(workItemId);
  if (!snapshot) return err(new DomainPricingError("PRICE_NOT_FOUND", "Pricing status was not found"));

  if (snapshot.status === "PRICED") {
    const validIds = await findValidCurrentPriceIds([
      { workItemId: snapshot.workItemId, currentPriceId: snapshot.currentPriceId },
    ]);
    const valid = snapshot.currentPriceId !== null && validIds.has(snapshot.currentPriceId);
    if (!valid) {
      // A PRICED row whose current price is missing, superseded, or stale for
      // the current specification reports as unresolved PENDING — fail closed,
      // never as deliverable.
      return ok({
        ...snapshot,
        status: "PENDING",
        waitingSince: snapshot.waitingSince ?? new Date(),
        currentPriceId: null,
      });
    }
  }
  return ok(snapshot);
}

export async function pendingSince(workItemId: string): Promise<Result<Date | null, DomainPricingError>> {
  return ok(await readPendingSince(workItemId));
}
