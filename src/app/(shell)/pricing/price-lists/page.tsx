// Price Lists admin page — 051 Pricing Engine (T035 / US7).
// Server Component: no "use client". All mutations use inline Server Actions.
// RTL: logical Tailwind properties only (ps-/pe-/ms-/me-/start-/end-/).
// Historical commercial values are append-only; retire replaces active records.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Coins, PlusCircle, CheckCircle2, XCircle, Sliders, Trash2, AlertCircle } from "lucide-react";
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
import { PriceListTierRows } from "~/components/pricing/price-list-tier-rows";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

const selectCls =
  "rounded-xl border border-input bg-background/80 px-3.5 py-2 text-sm text-foreground " +
  "focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 transition-all duration-200 shadow-2xs";

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
  { value: "PACK", label: "حزمة" },
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
    if (caught instanceof DomainPricingError) {
      redirect(`/pricing/price-lists?error=${encodeURIComponent(caught.message)}`);
    }
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

export default async function PriceListsPage({
  searchParams,
}: {
  readonly searchParams?: Promise<{ error?: string }>;
}) {
  const actor = await getActor();
  authorize(actor, "admin.config");
  const error = (await searchParams)?.error;

  const [priceLists, productTypes, activeProductTypes, policies] = await Promise.all([
    db.priceList.findMany({
      include: { tiers: { orderBy: { minimumQuantity: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    db.productType.findMany({ orderBy: { name: "asc" } }),
    db.productType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.productPricingPolicy.findMany(),
  ]);

  const productTypeById = new Map(productTypes.map((pt) => [pt.id, pt]));
  const policyByProductType = new Map(policies.map((p) => [p.productTypeId, p.mode]));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero Admin Header ── */}
      <div className="apple-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute top-0 end-0 -mt-8 -me-8 h-48 w-48 rounded-full bg-linear-to-br from-amber-500/10 to-orange-500/5 blur-2xl pointer-events-none" />

        <div className="relative flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25">
            <Coins className="h-7 w-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {S.adminPriceListsPageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">
              لوائح الأسعار الرسمية والشرائح الكمية وسياسات التسعير الثابت والمتغير
            </p>
          </div>
        </div>
      </div>

      {/* ── Set Pricing Policy Section Card ── */}
      <section className="apple-card p-6 sm:p-7">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{S.priceListPolicyHeading}</h2>
            <p className="text-xs text-muted-foreground">تحديد سياسة التسعير (ثابت أو متغير) لكل نوع منتج</p>
          </div>
        </div>

        <form action={setPolicyAction} className="flex flex-wrap items-end gap-3 max-w-2xl">
          <div className="flex flex-1 flex-col gap-1.5 min-w-[200px]">
            <label className="text-xs font-semibold text-foreground">
              {S.productTypeLabel}
            </label>
            <select name="productTypeId" required className={selectCls}>
              <option value="">— اختر نوع المنتج —</option>
              {activeProductTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-1 flex-col gap-1.5 min-w-[180px]">
            <label className="text-xs font-semibold text-foreground">
              {S.priceListModeLabel}
            </label>
            <select name="mode" required className={selectCls} defaultValue="FIXED">
              <option value="FIXED">FIXED — سعر ثابت</option>
              <option value="VARIABLE">VARIABLE — سعر متغير</option>
            </select>
          </div>

          <Button type="submit" variant="default">
            <span>{S.priceListSetPolicyButton}</span>
          </Button>
        </form>
      </section>

      {/* ── Create Price List Form Card ── */}
      <section className="apple-card p-6 sm:p-7">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{S.priceListCreateHeading}</h2>
            <p className="text-xs text-muted-foreground">إضافة لائحة أسعار جديدة مع تحديد فترات السريان والشرائح</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form action={createPriceListAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                {S.productTypeLabel}
              </label>
              <select name="productTypeId" required className={selectCls}>
                <option value="">— اختر نوع المنتج —</option>
                {activeProductTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
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
              <label className="text-xs font-semibold text-foreground">
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
              <label className="text-xs font-semibold text-foreground">
                {S.priceListEffectiveToLabel}
              </label>
              <input
                name="effectiveTo"
                type="date"
                className={inputCls}
              />
            </div>
          </div>

          {/* Tier rows */}
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <h3 className="mb-3 text-xs font-bold text-foreground">
              {S.priceListTiersHeading}
            </h3>
            <div id="tier-rows" className="flex flex-col gap-2">
              <PriceListTierRows labels={{ min: S.priceListTierMin, max: S.priceListTierMax, price: S.priceListTierPrice }} />
            </div>
            <p className="mt-2 text-2xs text-muted-foreground">
              {S.priceListTiersHint}
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" variant="default" className="w-full sm:w-auto">
              <PlusCircle className="h-4 w-4" />
              <span>{S.priceListCreateButton}</span>
            </Button>
          </div>
        </form>
      </section>

      {/* ── Active Price Lists Table Card ── */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border/70 bg-muted/40 text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderProductType}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderPricingMode}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderUnit}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderEffectiveFrom}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderEffectiveTo}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderTiers}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderStatus}</th>
                <th className="px-5 py-3.5 text-start">{S.tableHeaderActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {priceLists.map((pl) => {
                const pt = productTypeById.get(pl.productTypeId);
                return (
                  <tr key={pl.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-5 py-4 font-bold text-foreground">{pt?.name ?? "—"}</td>
                    <td className="px-5 py-4 font-mono">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-2xs font-semibold">
                        {policyByProductType.get(pl.productTypeId) ?? "FIXED"}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-foreground">
                      {UNITS.find((u) => u.value === pl.unit)?.label ?? pl.unit}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground" dir="ltr">
                      {new Date(pl.effectiveFrom).toLocaleDateString("ar-EG", { timeZone: "UTC" })}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground" dir="ltr">
                      {pl.effectiveTo
                        ? new Date(pl.effectiveTo).toLocaleDateString("ar-EG", { timeZone: "UTC" })
                        : S.priceListOpenEnded}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        {pl.tiers.map((tier) => (
                          <span key={tier.id} className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 font-mono text-2xs">
                            {tier.minimumQuantity}–{tier.maximumQuantity ?? "∞"}: <strong className="text-foreground">{tier.basePrice.toString()} ج.م</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
                          pl.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {pl.status === "ACTIVE" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        <span>{pl.status === "ACTIVE" ? S.statusActive : S.statusRetired}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {pl.status === "ACTIVE" && (
                        <form action={retirePriceListAction}>
                          <input type="hidden" name="priceListId" value={pl.id} />
                          <Button type="submit" variant="destructive" size="xs">
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{S.priceListRetireButton}</span>
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {priceLists.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                    {S.priceListEmpty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
