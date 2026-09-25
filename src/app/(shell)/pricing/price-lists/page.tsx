// Price Lists admin page — 051 Pricing Engine (T035 / US7).
// Server Component: no "use client". All mutations use inline Server Actions.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).
// Historical commercial values are append-only; retire replaces active records.

import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { getActor, authorize } from "~/server/auth";
import {
  createPriceList,
  retirePriceList,
  setPricingPolicy,
  DomainPricingError,
} from "~/server/pricing";
import type { PricingUnit, PricingMode } from "~/server/pricing";
import { Button } from "~/components/ui/button";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const selectCls =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0";

function formStr(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

type PriceTierFormValue = { minimumQuantity: number; maximumQuantity: number | null; basePrice: string };

function isPriceTier(value: unknown): value is PriceTierFormValue {
  if (!value || typeof value !== "object") return false;
  const tier = value as Record<string, unknown>;
  return typeof tier.minimumQuantity === "number"
    && (typeof tier.maximumQuantity === "number" || tier.maximumQuantity === null)
    && typeof tier.basePrice === "string";
}

const UNITS: readonly { value: PricingUnit; label: string }[] = [
  { value: "PIECE", label: "قطعة" },
  { value: "SQUARE_METER", label: "متر مربع" },
  { value: "LINEAR_METER", label: "متر خطي" },
  { value: "SHEET", label: "ورقة" },
  { value: "PACK", label: " חבילה" },
];

// ── Server Actions ─────────────────────────────────────────────────────────

async function setPolicyAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.config");
  const productTypeId = formStr(formData.get("productTypeId"));
  const mode = formStr(formData.get("mode")) as PricingMode;
  if (!productTypeId || !mode) return;
  await setPricingPolicy(actor, productTypeId, mode);
  revalidatePath("/pricing/price-lists");
}

async function createPriceListAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.config");
  const productTypeId = formStr(formData.get("productTypeId"));
  const unit = formStr(formData.get("unit")) as PricingUnit;
  const effectiveFrom = formStr(formData.get("effectiveFrom"));
  const effectiveTo = formStr(formData.get("effectiveTo"));

  if (!productTypeId || !unit || !effectiveFrom) return;

  // Parse tier rows from the form.
  const tierJson = formStr(formData.get("tiers"));
  let parsedTiers: unknown;
  try {
    parsedTiers = JSON.parse(tierJson) as unknown;
  } catch {
    return;
  }
  if (!Array.isArray(parsedTiers) || parsedTiers.length === 0) return;
  const tiers = parsedTiers.filter(isPriceTier);
  if (tiers.length !== parsedTiers.length) return;

  try {
    await createPriceList(actor, {
      productTypeId,
      unit,
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      tiers: tiers.map((t) => ({
        minimumQuantity: t.minimumQuantity,
        maximumQuantity: t.maximumQuantity,
        basePrice: t.basePrice,
      })),
    });
  } catch (caught) {
    if (caught instanceof DomainPricingError) return;
    throw caught;
  }
  revalidatePath("/pricing/price-lists");
}

async function retirePriceListAction(formData: FormData) {
  "use server";
  const actor = await getActor();
  authorize(actor, "admin.config");
  const priceListId = formStr(formData.get("priceListId"));
  if (!priceListId) return;
  await retirePriceList(actor, priceListId);
  revalidatePath("/pricing/price-lists");
}

// ── Page Component ─────────────────────────────────────────────────────────

export default async function PriceListsPage() {
  const actor = await getActor();
  authorize(actor, "admin.config");

  const [priceLists, productTypes, policies] = await Promise.all([
    db.priceList.findMany({
      include: { tiers: { orderBy: { minimumQuantity: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    db.productType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.productPricingPolicy.findMany(),
  ]);

  const productTypeById = new Map(productTypes.map((pt) => [pt.id, pt]));
  const policyByProductType = new Map(policies.map((p) => [p.productTypeId, p.mode]));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{S.adminPriceListsPageTitle}</h1>

      {/* ── Set Pricing Policy Section ──────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">{S.priceListPolicyHeading}</h2>
        <form action={setPolicyAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              {S.productTypeLabel}
            </label>
            <select name="productTypeId" required className={selectCls}>
              <option value="">—</option>
              {productTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              {S.priceListModeLabel}
            </label>
            <select name="mode" required className={selectCls} defaultValue="FIXED">
              <option value="FIXED">FIXED — سعر ثابت</option>
              <option value="VARIABLE">VARIABLE — سعر متغير</option>
            </select>
          </div>
          <Button type="submit" variant="default">
            {S.priceListSetPolicyButton}
          </Button>
        </form>
      </section>

      {/* ── Create Price List Form ──────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">{S.priceListCreateHeading}</h2>
        <form action={createPriceListAction} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.productTypeLabel}
              </label>
              <select name="productTypeId" required className={selectCls}>
                <option value="">—</option>
                {productTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.priceListUnitLabel}
              </label>
              <select name="unit" required className={selectCls}>
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.priceListEffectiveFromLabel}
              </label>
              <input
                name="effectiveFrom"
                type="date"
                required
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {S.priceListEffectiveToLabel}
              </label>
              <input
                name="effectiveTo"
                type="date"
                className={inputCls}
              />
            </div>
          </div>

          {/* Tier rows — client-visible static rows; serialized as JSON for the action */}
          <div className="rounded-md border border-border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-medium text-foreground">
              {S.priceListTiersHeading}
            </h3>
            <div id="tier-rows" className="flex flex-col gap-2">
              <TierRow index={0} />
              <TierRow index={1} />
              <TierRow index={2} />
            </div>
            <input type="hidden" name="tiers" id="tiers-json" value="[]" />
            <p className="mt-2 text-xs text-muted-foreground">
              {S.priceListTiersHint}
            </p>
          </div>

          <div>
            <Button type="submit" variant="default">
              {S.priceListCreateButton}
            </Button>
          </div>
        </form>
      </section>

      {/* ── Active Price Lists ──────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderProductType}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderPricingMode}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderUnit}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderEffectiveFrom}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderEffectiveTo}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderTiers}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderStatus}</th>
              <th className="px-4 py-3 text-start font-medium">{S.tableHeaderActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {priceLists.map((pl) => {
              const pt = productTypeById.get(pl.productTypeId);
              return (
                <tr key={pl.id} className="bg-card hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{pt?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {policyByProductType.get(pl.productTypeId) ?? "FIXED"}
                  </td>
                  <td className="px-4 py-3">
                    {UNITS.find((u) => u.value === pl.unit)?.label ?? pl.unit}
                  </td>
                  <td className="px-4 py-3" dir="ltr">{new Date(pl.effectiveFrom).toLocaleDateString("ar-EG")}</td>
                  <td className="px-4 py-3" dir="ltr">
                    {pl.effectiveTo
                      ? new Date(pl.effectiveTo).toLocaleDateString("ar-EG")
                      : S.priceListOpenEnded}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5 text-xs">
                      {pl.tiers.map((tier) => (
                        <span key={tier.id}>
                          {tier.minimumQuantity}–{tier.maximumQuantity ?? "∞"}: {tier.basePrice.toString()} EGP
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        pl.status === "ACTIVE"
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }
                    >
                      {pl.status === "ACTIVE" ? S.statusActive : S.statusRetired}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {pl.status === "ACTIVE" && (
                      <form action={retirePriceListAction} className="flex">
                        <input type="hidden" name="priceListId" value={pl.id} />
                        <Button type="submit" variant="destructive" size="sm">
                          {S.priceListRetireButton}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {priceLists.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  {S.priceListEmpty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tier row component (server-rendered; hidden input holds JSON) ──────────
function TierRow({ index }: { readonly index: number }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <span className="text-xs font-medium text-muted-foreground w-6">{index + 1}.</span>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">{S.priceListTierMin}</label>
        <input
          name={`tierMin_${index}`}
          type="number"
          min="1"
          required
          defaultValue={index === 0 ? 1 : undefined}
          className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">{S.priceListTierMax}</label>
        <input
          name={`tierMax_${index}`}
          type="number"
          min="0"
          className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
          placeholder="∞"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">{S.priceListTierPrice}</label>
        <input
          name={`tierPrice_${index}`}
          type="number"
          min="0.01"
          step="0.01"
          required
          className="w-32 rounded-md border border-input bg-background px-2 py-1 text-sm"
          placeholder="EGP"
        />
      </div>
    </div>
  );
}
