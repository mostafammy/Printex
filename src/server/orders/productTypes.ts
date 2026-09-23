// productTypes.ts — Product Type catalog: read helper (US2) + admin CRUD
// (Polish phase). contracts/product-types.md, contracts/order-entry.md.

import { z } from "zod";
import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { authorize, audit } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { DomainOrderError } from "./errors";
import { productTypeNameSchema } from "./validation";

export interface ActiveProductType {
  id: string;
  name: string;
  defaultDepartmentId: string | null;
  defaultRequiresDesign: boolean;
  defaultRequiresReview: boolean;
}

/**
 * Read-only helper for populating Work Item pickers (US2). No `authorize`
 * restriction beyond the caller already holding `order.create` — deactivated
 * types never appear here (contracts/product-types.md).
 */
export async function listActiveProductTypes(_actor: Actor): Promise<ActiveProductType[]> {
  return db.productType.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      defaultDepartmentId: true,
      defaultRequiresDesign: true,
      defaultRequiresReview: true,
    },
    orderBy: { name: "asc" },
  });
}

// ── Admin CRUD (contracts/product-types.md) ────────────────────────────────

const PRISMA_UNIQUE_VIOLATION = "P2002";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === PRISMA_UNIQUE_VIOLATION
  );
}

const createProductTypeSchema = z.object({
  name: productTypeNameSchema,
  defaultDepartmentId: z.string().min(1).optional(),
  defaultRequiresDesign: z.boolean().default(true),
  defaultRequiresReview: z.boolean().default(true),
  pricingModeHint: z.string().optional(),
});

export type CreateProductTypeInput = z.input<typeof createProductTypeSchema>;

export async function createProductType(
  actor: Actor,
  input: CreateProductTypeInput,
): Promise<{ productTypeId: string }> {
  authorize(actor, "admin.config");
  const parsed = createProductTypeSchema.parse(input);

  try {
    let productTypeId!: string;
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const productType = await tx.productType.create({ data: parsed });
      productTypeId = productType.id;

      await audit.record(tx, {
        action: "producttype.created",
        entityType: "ProductType",
        entityId: productType.id,
        actorId: actor.userId,
        after: parsed,
      });
    });
    return { productTypeId };
  } catch (caught) {
    if (isUniqueViolation(caught)) {
      throw new DomainOrderError("DUPLICATE_NAME", `A product type named "${parsed.name}" already exists.`);
    }
    throw caught;
  }
}

export async function renameProductType(
  actor: Actor,
  productTypeId: string,
  newName: string,
): Promise<void> {
  authorize(actor, "admin.config");
  const name = productTypeNameSchema.parse(newName);

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.productType.findUniqueOrThrow({ where: { id: productTypeId } });

      await tx.productType.update({ where: { id: productTypeId }, data: { name } });

      await audit.record(tx, {
        action: "producttype.renamed",
        entityType: "ProductType",
        entityId: productTypeId,
        actorId: actor.userId,
        before: { name: existing.name },
        after: { name },
      });
    });
  } catch (caught) {
    if (isUniqueViolation(caught)) {
      throw new DomainOrderError("DUPLICATE_NAME", `A product type named "${name}" already exists.`);
    }
    throw caught;
  }
}

const updateDefaultsSchema = z.object({
  defaultDepartmentId: z.string().min(1).nullable().optional(),
  defaultRequiresDesign: z.boolean().optional(),
  defaultRequiresReview: z.boolean().optional(),
  pricingModeHint: z.string().nullable().optional(),
});

export type UpdateProductTypeDefaultsInput = z.input<typeof updateDefaultsSchema>;

export async function updateProductTypeDefaults(
  actor: Actor,
  productTypeId: string,
  patch: UpdateProductTypeDefaultsInput,
): Promise<void> {
  authorize(actor, "admin.config");
  const parsed = updateDefaultsSchema.parse(patch);

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.productType.findUniqueOrThrow({ where: { id: productTypeId } });

    await tx.productType.update({ where: { id: productTypeId }, data: parsed });

    await audit.record(tx, {
      action: "producttype.defaults_updated",
      entityType: "ProductType",
      entityId: productTypeId,
      actorId: actor.userId,
      before: {
        defaultDepartmentId: existing.defaultDepartmentId,
        defaultRequiresDesign: existing.defaultRequiresDesign,
        defaultRequiresReview: existing.defaultRequiresReview,
        pricingModeHint: existing.pricingModeHint,
      },
      after: parsed,
    });
  });
}

export async function deactivateProductType(actor: Actor, productTypeId: string): Promise<void> {
  authorize(actor, "admin.config");

  const existing = await db.productType.findUnique({ where: { id: productTypeId } });
  // No delete path exists — deactivate only (constitution VI), mirrors deactivateDepartment.
  if (!existing?.isActive) return;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.productType.update({ where: { id: productTypeId }, data: { isActive: false } });

    await audit.record(tx, {
      action: "producttype.deactivated",
      entityType: "ProductType",
      entityId: productTypeId,
      actorId: actor.userId,
      before: { isActive: true },
      after: { isActive: false },
    });
  });
}
