// FinanceConfig — 052-finance FR-003/FR-014/FR-013/FR-027 (constitution VI).
//
// Reads resolve to the DB singleton row when one exists (admin edits via
// `updateFinanceConfig`), otherwise to the YAML seed — config/052-finance.yaml
// is the default source (FileConfig / 050-files.yaml precedent). Money rows
// snapshot their labels at record time, so history is unaffected by edits.

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { Prisma } from "../../../generated/prisma";
import { audit, authorize } from "~/server/auth";
import type { Actor } from "~/server/auth";
import { db } from "~/server/db";
import { FINANCE_AUDIT_ACTIONS } from "./audit";
import { DomainFinanceError } from "./errors";
import { parseNonNegativeDecimal } from "./money";

export interface FinanceConfigData {
  paymentMethods: string[];
  paymentSources: string[];
  expenseCategories: Array<{ label: string; active: boolean }>;
  approvalThreshold: string;
  shopTimezone: string;
}

let yamlCache: FinanceConfigData | null = null;

function loadYamlConfig(): FinanceConfigData {
  if (yamlCache) return yamlCache;
  const resolvedPath =
    process.env.FINANCE_CONFIG_PATH ??
    path.resolve(process.cwd(), "config", "052-finance.yaml");

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }
  const parsed = yaml.parse(fs.readFileSync(resolvedPath, "utf-8")) as FinanceConfigData;

  if (!Array.isArray(parsed.paymentMethods) || parsed.paymentMethods.length === 0) {
    throw new Error("Config: paymentMethods must be a non-empty array");
  }
  if (!Array.isArray(parsed.paymentSources) || parsed.paymentSources.length === 0) {
    throw new Error("Config: paymentSources must be a non-empty array");
  }
  if (!Array.isArray(parsed.expenseCategories) || parsed.expenseCategories.length === 0) {
    throw new Error("Config: expenseCategories must be a non-empty array");
  }
  for (const category of parsed.expenseCategories) {
    if (!category?.label || typeof category.active !== "boolean") {
      throw new Error("Config: each expense category needs a label and active flag");
    }
  }
  const threshold = parseNonNegativeDecimal(String(parsed.approvalThreshold ?? "0"));
  if (!parsed.shopTimezone) {
    throw new Error("Config: shopTimezone is required");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: parsed.shopTimezone });
  } catch {
    throw new Error(`Config: shopTimezone is not a valid IANA zone: ${parsed.shopTimezone}`);
  }

  yamlCache = {
    paymentMethods: parsed.paymentMethods,
    paymentSources: parsed.paymentSources,
    expenseCategories: parsed.expenseCategories,
    approvalThreshold: threshold.toString(),
    shopTimezone: parsed.shopTimezone,
  };
  return yamlCache;
}

/** Effective config: DB singleton row when present, else the YAML seed. */
export async function getFinanceConfig(): Promise<FinanceConfigData> {
  const row = await db.financeConfig.findUnique({ where: { id: "finance-config" } });
  if (!row) return loadYamlConfig();
  return {
    paymentMethods: row.paymentMethods as string[],
    paymentSources: row.paymentSources as string[],
    expenseCategories: row.expenseCategories as Array<{ label: string; active: boolean }>,
    approvalThreshold: row.approvalThreshold.toString(),
    shopTimezone: row.shopTimezone,
  };
}

export async function isActiveMethod(value: string): Promise<boolean> {
  return (await getFinanceConfig()).paymentMethods.includes(value);
}

export async function isActiveSource(value: string): Promise<boolean> {
  return (await getFinanceConfig()).paymentSources.includes(value);
}

export async function isActiveCategory(value: string): Promise<boolean> {
  return (await getFinanceConfig()).expenseCategories.some(
    (category) => category.active && category.label === value,
  );
}

export async function getApprovalThreshold(): Promise<Prisma.Decimal> {
  return new Prisma.Decimal((await getFinanceConfig()).approvalThreshold);
}

export async function getShopTimezone(): Promise<string> {
  return (await getFinanceConfig()).shopTimezone;
}

/**
 * Admin write path (FR-003/FR-013/FR-014): gated by `admin.config`, audited
 * `config.updated` in the same transaction as the row write. Replaces the
 * singleton (create-or-update); YAML remains the cold-start seed.
 */
export async function updateFinanceConfig(
  actor: Actor,
  patch: Partial<FinanceConfigData>,
): Promise<FinanceConfigData> {
  authorize(actor, "admin.config");

  const current = await getFinanceConfig();
  const next: FinanceConfigData = {
    paymentMethods: patch.paymentMethods ?? current.paymentMethods,
    paymentSources: patch.paymentSources ?? current.paymentSources,
    expenseCategories: patch.expenseCategories ?? current.expenseCategories,
    approvalThreshold: patch.approvalThreshold
      ? parseNonNegativeDecimal(patch.approvalThreshold).toString()
      : current.approvalThreshold,
    shopTimezone: patch.shopTimezone ?? current.shopTimezone,
  };
  if (next.paymentMethods.length === 0 || next.paymentSources.length === 0) {
    throw new DomainFinanceError("VALIDATION", "Method and source lists must not be empty");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: next.shopTimezone });
  } catch {
    throw new DomainFinanceError("VALIDATION", `Invalid shop timezone: ${next.shopTimezone}`);
  }

  await db.$transaction(async (tx) => {
    await tx.financeConfig.upsert({
      where: { id: "finance-config" },
      create: {
        id: "finance-config",
        paymentMethods: next.paymentMethods,
        paymentSources: next.paymentSources,
        expenseCategories: next.expenseCategories,
        approvalThreshold: new Prisma.Decimal(next.approvalThreshold),
        shopTimezone: next.shopTimezone,
        updatedById: actor.userId,
        updatedAt: new Date(),
      },
      update: {
        paymentMethods: next.paymentMethods,
        paymentSources: next.paymentSources,
        expenseCategories: next.expenseCategories,
        approvalThreshold: new Prisma.Decimal(next.approvalThreshold),
        shopTimezone: next.shopTimezone,
        updatedById: actor.userId,
        updatedAt: new Date(),
      },
    });
    await audit.record(tx, {
      action: FINANCE_AUDIT_ACTIONS.configUpdated,
      entityType: "FinanceConfig",
      entityId: "finance-config",
      actorId: actor.userId,
      before: current,
      after: next,
    });
  });
  return next;
}

/** Test hook — drop the YAML cache (DB rows are read fresh every call). */
export function resetFinanceConfigCache(): void {
  yamlCache = null;
}
