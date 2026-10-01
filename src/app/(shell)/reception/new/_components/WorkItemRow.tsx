"use client";

// WorkItemRow — the per-item editor on /reception/new.
//
// This is a Client Component because 093's reception flow needs a LIVE price:
// the receptionist types a width and immediately sees which roll it will be
// printed on, how many square metres that is, and what the customer will be
// charged. A server-rendered form cannot do that.
//
// The obvious way to get a live price is a server round trip per keystroke.
// That is what this file used to do, and it was unusable: a quote cost a
// session lookup, an RBAC load, the width-rule read and the finishing-rate read
// — four queries through the Supabase transaction pooler — behind a 400 ms
// debounce, so the number appeared a second or more after the last keystroke,
// or not at all when the pooler was slow. A price that arrives after you stop
// typing is not a live price.
//
// So the calculation runs HERE, in a `useMemo`, over functions imported from
// `~/lib/production` — the very modules `setProductionSpec` runs on submit.
// This is not a second copy of the money maths: `resolveProductionWidth`,
// `computeProductionArea`, `quoteRoll`, `assertHeightWithinCap` and
// `assertRateWithinBand` are the same code, with the same `decimal.js` values
// and the same single whole-EGP rounding site. A form that duplicated them
// would drift the first time one side changed; a form that imports them cannot.
// The server still re-derives and re-validates everything on submit and refuses
// to write a specification it cannot price, so the preview is a fast preview,
// never the authority.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Trash2, Ruler, Calculator, TriangleAlert, Package } from "lucide-react";

import { parseDecimalField } from "~/lib/production/decimal";
import { deriveProductionSpec, type DeriveConstraints, type DerivedSnapshot } from "~/lib/production/derive";
import { DomainProductionSpecError, type ProductionSpecErrorCode } from "~/lib/production/errors";
import type { FinishingRate } from "~/lib/production/quote";
import { assertWidthLadder, resolveProductionWidth } from "~/lib/production/widths";
import ar from "~/messages/ar.json";

const S = ar.ui;

const inputCls =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

const inputClsInvalid =
  "w-full rounded-xl border border-destructive/70 bg-destructive/5 px-3.5 py-2.5 text-sm text-foreground " +
  "focus:outline-none focus:border-destructive focus:ring-3 focus:ring-destructive/25 transition-all duration-200 shadow-2xs";

export type RowProductType = {
  readonly id: string;
  readonly name: string;
  /** Where this type's work items route. `null` when unconfigured. */
  readonly defaultDepartmentName: string | null;
  readonly defaultRequiresDesign: boolean;
  readonly defaultRequiresReview: boolean;
};

/** The 093 configuration a governed product type carries, flattened for the client. */
export type RowGovernance = {
  readonly ladderCm: readonly number[];
  readonly maxHeightM: string;
  readonly minRatePerSqm: string;
  readonly maxRatePerSqm: string;
  /** Midpoint of the configured band — what the rate field opens at. */
  readonly suggestedRatePerSqm: string;
};

export type RowFinishing = {
  readonly id: string;
  readonly code: string;
  readonly labelAr: string;
  readonly ratePerSqm: string;
};

/**
 * What the row can show about the current figures.
 *
 * A refusal is a first-class answer, not an error: the point of a live price is
 * that a 330 cm width or a rate under the floor is explained in the field while
 * the receptionist is still typing.
 */
type LiveQuote =
  | { readonly ok: true; readonly quote: DerivedSnapshot }
  | {
      readonly ok: false;
      readonly code: ProductionSpecErrorCode;
      readonly message: string;
    };

export type WorkItemRowProps = {
  readonly index: number;
  readonly isFirst: boolean;
  readonly removeHref: string;
  readonly productTypes: readonly RowProductType[];
  readonly governance: Readonly<Record<string, RowGovernance>>;
  readonly finishings: readonly RowFinishing[];
};

export function WorkItemRow({
  index,
  isFirst,
  removeHref,
  productTypes,
  governance,
  finishings,
}: WorkItemRowProps) {
  const name = `item.${index}`;
  const p = (field: string) => `${name}.${field}`;

  const [productTypeId, setProductTypeId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [customerWidthCm, setCustomerWidthCm] = useState("");
  const [heightM, setHeightM] = useState("");
  const [ratePerSqm, setRatePerSqm] = useState("");
  const [finishingCodes, setFinishingCodes] = useState<readonly string[]>([]);
  // Held as state, not `defaultChecked`, so they can actually follow the chosen
  // product type. `flagsTouched` latches once the receptionist sets one by hand:
  // a deliberate override for this order must survive switching product types.
  const [requiresDesign, setRequiresDesign] = useState(true);
  const [requiresReview, setRequiresReview] = useState(true);
  const [flagsTouched, setFlagsTouched] = useState(false);

  const productType = productTypes.find((pt) => pt.id === productTypeId);
  const rule = productTypeId ? governance[productTypeId] : undefined;
  const governed = rule !== undefined;

  // Picking a product type re-derives everything that type decides: the rate
  // band it opens at, and its design/review defaults. Only the transition sets
  // an initial value — a hand-typed rate is never overwritten, because a
  // receptionist raising the rate for a specific order is normal.
  const lastProductTypeRef = useRef("");
  useEffect(() => {
    if (productTypeId === lastProductTypeRef.current) return;
    lastProductTypeRef.current = productTypeId;
    if (rule) setRatePerSqm(rule.suggestedRatePerSqm);
    if (!flagsTouched) {
      setRequiresDesign(productType?.defaultRequiresDesign ?? true);
      setRequiresReview(productType?.defaultRequiresReview ?? true);
    }
  }, [productTypeId, rule, flagsTouched, productType]);

  // ── The live price ───────────────────────────────────────────────────────
  //
  // Everything below is a `useMemo` over `deriveProductionSpec`: the same
  // function `setProductionSpec` runs on submit, called with the same
  // configuration the server would read for this product type. There is no
  // request, no debounce and no loading state, because there is nothing to
  // wait for — the number moves as the cursor moves.

  // The rule arrives as JSON (a ladder of plain numbers, three decimal
  // strings), so it is validated and parsed once per product type rather than
  // on every keystroke. `null` means the stored configuration is unusable;
  // that is surfaced as a refusal below, not silently treated as "un-governed".
  const configuration = useMemo<DeriveConstraints | null>(() => {
    if (!rule) return null;
    const maxHeightM = parseDecimalField(rule.maxHeightM);
    const minRatePerSqm = parseDecimalField(rule.minRatePerSqm);
    const maxRatePerSqm = parseDecimalField(rule.maxRatePerSqm);
    if (!maxHeightM || !minRatePerSqm || !maxRatePerSqm) return null;
    try {
      return {
        ladder: assertWidthLadder(rule.ladderCm),
        maxHeightM,
        minRatePerSqm,
        maxRatePerSqm,
      };
    } catch {
      return null;
    }
  }, [rule]);

  // The width hint stands on its own so the over-maximum warning appears the
  // moment a width is too large, without waiting for a height and a rate. It is
  // the production round-up itself (`resolveProductionWidth`), not a scan of
  // the list re-implemented here — an earlier version of this file did
  // re-implement it, and a browser-side ladder is exactly the kind of second
  // copy that eventually disagrees with the roll.
  const widthResolution = useMemo(() => {
    if (!configuration) return null;
    const requested = parseDecimalField(customerWidthCm);
    if (!requested) return null;
    return resolveProductionWidth(requested, configuration.ladder);
  }, [configuration, customerWidthCm]);

  const quote = useMemo<LiveQuote | null>(() => {
    if (!rule) return null;

    // A governed row whose configuration cannot be read is a configuration
    // bug, and the receptionist needs to be told that rather than shown a
    // blank panel they will try to fix by retyping their own numbers.
    if (!configuration) {
      return {
        ok: false,
        code: "INVALID_WIDTH_LADDER",
        message: "The production width configuration for this product type is unusable",
      };
    }

    const width = parseDecimalField(customerWidthCm);
    const height = parseDecimalField(heightM);
    const rate = parseDecimalField(ratePerSqm);
    if (!width || !height || !rate) return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return null;

    // Mirrors `resolveFinishingRates`: a selected code that is not in the
    // catalogue is a refusal, never a silent skip. "The customer paid for
    // Sulfan and we quietly dropped it" is the bug this feature exists to
    // prevent, and the browser must not be more forgiving than the server.
    const finishingRates: FinishingRate[] = [];
    for (const code of finishingCodes) {
      const service = finishings.find((f) => f.code === code);
      const serviceRate = service ? parseDecimalField(service.ratePerSqm) : null;
      if (!service || !serviceRate) {
        return {
          ok: false,
          code: "FINISHING_UNAVAILABLE",
          message: `Finishing "${code}" is not available for pricing`,
        };
      }
      finishingRates.push({
        finishingServiceId: service.id,
        code: service.code,
        labelAr: service.labelAr,
        ratePerSqm: serviceRate,
      });
    }

    try {
      const derived = deriveProductionSpec(
        {
          customerWidthCm: width,
          heightM: height,
          quantity,
          baseRatePerSqm: rate,
          finishingRates,
          // No exception can exist yet: a width exception is raised against a
          // work item, and this row has not been saved. So an over-ceiling
          // width is refused here, exactly as the server refuses it on submit.
          exception: null,
        },
        configuration,
      );
      return { ok: true, quote: derived.snapshot };
    } catch (error) {
      if (error instanceof DomainProductionSpecError) {
        return { ok: false, code: error.code, message: error.message };
      }
      throw error;
    }
  }, [
    rule,
    configuration,
    customerWidthCm,
    heightM,
    ratePerSqm,
    quantity,
    finishingCodes,
    finishings,
  ]);

  const toggleFinishing = (code: string) => {
    setFinishingCodes((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  };

  // The legacy generic dimension columns are derived from the spec panel while a
  // product is governed, so the Work Item still carries a coherent
  // width/height pair (both in centimetres) and the free-text dimension fields
  // do not compete with the ones that actually drive the price.
  const heightCm = Number.isFinite(Number(heightM)) ? String(Number(heightM) * 100) : "";
  const derivedWidthCm = Number.isFinite(Number(customerWidthCm)) ? String(Number(customerWidthCm)) : "";

  return (
    <div className="relative rounded-xl border border-border/70 bg-card shadow-xs p-6 sm:p-7">
      <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
        <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary">
          صنف #{index + 1}
        </span>
        {!isFirst && (
          <Link
            href={removeHref}
            className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{S.removeWorkItemRowButton}</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* The product type IS the routing decision — it decides the department,
            whether the row is width-governed, and the design/review defaults.
            The department is shown as read-only routing information rather than
            a second picker that could contradict it. */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span>{S.productTypeLabel}</span>
          </label>
          <select
            name={p("productTypeId")}
            className={inputCls}
            value={productTypeId}
            onChange={(event) => setProductTypeId(event.target.value)}
            required
            aria-describedby={`${name}-route-hint`}
          >
            <option value="" disabled>
              {S.productTypePlaceholder}
            </option>
            {productTypes.map((pt) => (
              <option key={pt.id} value={pt.id}>
                {pt.name}
              </option>
            ))}
          </select>
          <p id={`${name}-route-hint`} className="text-2xs text-muted-foreground">
            {!productType
              ? S.productTypeRoutesHintEmpty
              : productType.defaultDepartmentName
                ? S.productTypeRoutesHint.replace("{department}", productType.defaultDepartmentName)
                : S.productTypeRoutesWarning}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">{S.quantityLabel}</label>
          <input
            name={p("quantity")}
            type="number"
            min={1}
            step={1}
            required
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.trunc(Number(event.target.value) || 1)))}
            className={inputCls}
          />
        </div>

        {/* Both boxes arrive pre-set from the chosen product type and stay
            editable — a roll does not need review, a laser-cut sign might. */}
        <div className="flex flex-col justify-center gap-2.5">
          <div className="flex items-center gap-2">
            <input
              id={p("requiresDesign")}
              name={p("requiresDesign")}
              type="checkbox"
              checked={requiresDesign}
              onChange={(event) => {
                setFlagsTouched(true);
                setRequiresDesign(event.target.checked);
              }}
              className="h-4 w-4 cursor-pointer rounded accent-primary"
            />
            <label htmlFor={p("requiresDesign")} className="cursor-pointer text-xs font-semibold text-foreground">
              {S.requiresDesignLabel}
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id={p("requiresReview")}
              name={p("requiresReview")}
              type="checkbox"
              checked={requiresReview}
              onChange={(event) => {
                setFlagsTouched(true);
                setRequiresReview(event.target.checked);
              }}
              className="h-4 w-4 cursor-pointer rounded accent-primary"
            />
            <label htmlFor={p("requiresReview")} className="cursor-pointer text-xs font-semibold text-foreground">
              {S.requiresReviewLabel}
            </label>
          </div>
        </div>

        {governed ? (
          <>
            {/* 093 replaces the free-text dimensions with the governed ones. */}
            <input type="hidden" name={p("dimensionUnit")} value="CM" />
            <input type="hidden" name={p("widthValue")} value={derivedWidthCm} />
            <input type="hidden" name={p("heightValue")} value={heightCm} />

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Ruler className="h-3.5 w-3.5 text-primary" />
                <span>عرض العميل (سم)</span>
              </label>
              <input
                name={p("spec.customerWidthCm")}
                type="number"
                min={0}
                step="0.1"
                required
                value={customerWidthCm}
                onChange={(event) => setCustomerWidthCm(event.target.value)}
                placeholder="145"
                className={widthResolution?.ok === false ? inputClsInvalid : inputCls}
                aria-describedby={`${name}-width-hint`}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">الطول (متر)</label>
              <input
                name={p("spec.heightM")}
                type="number"
                min={0}
                step="0.01"
                required
                value={heightM}
                onChange={(event) => setHeightM(event.target.value)}
                placeholder="2"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">سعر المتر المربع (ج.م)</label>
              <input
                name={p("spec.baseRatePerSqm")}
                type="number"
                min={0}
                step="0.5"
                required
                value={ratePerSqm}
                onChange={(event) => setRatePerSqm(event.target.value)}
                placeholder={rule.suggestedRatePerSqm}
                className={inputCls}
              />
              <p className="text-2xs text-muted-foreground">
                المسموح: {rule.minRatePerSqm} – {rule.maxRatePerSqm} ج.م/م²
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">{S.dimensionUnitLabel}</label>
              <select name={p("dimensionUnit")} className={inputCls} defaultValue="CM">
                <option value="MM">MM (مليمتر)</option>
                <option value="CM">CM (سنتيمتر)</option>
                <option value="M">M (متر)</option>
                <option value="IN">IN (بوصة)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">{S.widthLabel}</label>
              <input name={p("widthValue")} type="number" min={0.01} step="0.01" required placeholder="العرض..." className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">{S.heightLabel}</label>
              <input name={p("heightValue")} type="number" min={0.01} step="0.01" required placeholder="الارتفاع..." className={inputCls} />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">{S.materialLabel}</label>
          <input name={p("material")} type="text" placeholder="نوع الورق أو الخامة..." className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">{S.itemDueDateLabel}</label>
          <input name={p("dueDate")} type="date" className={inputCls} />
        </div>

        {/* The finishing catalogue replaces the free-text note for governed
            products: 093's add-ons are priced per m², so they cannot stay a
            string someone has to remember to read. */}
        {governed ? (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-foreground">خدمات التشطيب</span>
            <div className="flex flex-wrap gap-2">
              {finishings.length === 0 && (
                <p className="text-2xs text-muted-foreground">لا توجد خدمات تشطيب مُعرَّفة بعد.</p>
              )}
              {finishings.map((f) => {
                const checked = finishingCodes.includes(f.code);
                return (
                  <label
                    key={f.code}
                    className={
                      "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors " +
                      (checked
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/70 bg-background/60 text-foreground hover:bg-muted")
                    }
                  >
                    <input
                      type="checkbox"
                      name={p("spec.finishingCodes")}
                      value={f.code}
                      checked={checked}
                      onChange={() => toggleFinishing(f.code)}
                      className="h-3.5 w-3.5 rounded accent-primary"
                    />
                    <span>{f.labelAr}</span>
                    <span className="font-mono text-2xs text-muted-foreground">{f.ratePerSqm} ج.م/م²</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-foreground">{S.finishNotesLabel}</label>
            <input name={p("finishNotes")} type="text" placeholder="سلوفان، ريجة، تكسير، بصمة..." className={inputCls} />
          </div>
        )}

        <div className="flex flex-col gap-1.5 sm:col-span-3">
          <label className="text-xs font-semibold text-foreground">{S.descriptionLabel}</label>
          <input name={p("description")} type="text" placeholder="وصف تفصيلي لصنف العمل..." className={inputCls} />
        </div>
      </div>

      {/* ── The live quote ── */}
      {governed && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <div id={`${name}-width-hint`} className="mb-3 flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
            <Ruler className="h-3.5 w-3.5" />
            <span>عروض الرول المتاحة:</span>
            <span className="font-mono text-foreground">{rule.ladderCm.join(" - ")}</span>
            <span className="text-muted-foreground">سم</span>
          </div>

          {widthResolution?.ok === false && (
            <p className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-2xs text-destructive">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                العرض المطلوب أكبر من أقصى عرض متاح ({widthResolution.maxWidthCm} سم). لن يتم تصغيره تلقائياً — يجب
                رفع استثناء واعتماده من المدير أولاً.
              </span>
            </p>
          )}

          {widthResolution?.ok === true && widthResolution.rounded && (
            <p className="mb-3 flex items-center gap-2 text-2xs text-muted-foreground">
              <Ruler className="h-3.5 w-3.5 text-primary" />
              <span>
                سيُنفَّذ على رول{" "}
                <span className="font-mono font-bold text-foreground">
                  {widthResolution.productionWidthCm} سم
                </span>{" "}
                (تقرريب لأعلى من {widthResolution.customerWidthCm} سم)
              </span>
            </p>
          )}

          <QuotePanel quote={quote} quantity={quantity} />
        </div>
      )}

      <p className="mt-4 text-2xs text-muted-foreground">{S.filesPlaceholderNote}</p>
    </div>
  );
}

function QuotePanel({
  quote,
  quantity,
}: {
  quote: LiveQuote | null;
  quantity: number;
}) {
  if (quote && !quote.ok) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-destructive">لا يمكن التسعير</span>
          <span className="text-2xs text-destructive/90">{ARABIC_REJECTIONS[quote.code] ?? quote.message}</span>
        </div>
      </div>
    );
  }

  if (!quote?.ok) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-2xs text-muted-foreground">
        <Calculator className="h-3.5 w-3.5" />
        <span>أدخل العرض والطول والسعر لعرض السعر المحسوب.</span>
      </div>
    );
  }

  const q = quote.quote;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
          <Calculator className="h-3.5 w-3.5" />
          <span>السعر المحسوب</span>
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-2xs sm:grid-cols-3">
        <Row label="عرض الإنتاج" value={`${q.productionWidthCm} سم`} strong />
        <Row label="المساحة" value={`${q.areaSqm} م²`} />
        <Row label="الكمية" value={String(q.quantity)} />
        <Row label="سعر المتر المربع" value={`${q.baseRatePerSqm} ج.م`} />
        <Row label="إجمالي المساحة" value={`${q.baseTotal} ج.م`} />
        <Row label="إجمالي التشطيب" value={`${q.finishingTotal} ج.م`} />
      </dl>

      {q.finishings.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-primary/20 pt-2.5 text-2xs">
          {q.finishings.map((f) => (
            <li key={f.finishingServiceId} className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {f.labelAr} <span className="font-mono">({f.ratePerSqm} ج.م/م²)</span>
              </span>
              <span className="font-mono">{f.amount} ج.م</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-baseline justify-between border-t border-primary/20 pt-2.5">
        <span className="text-xs font-bold text-foreground">الإجمالي النهائي</span>
        <span className="font-mono text-base font-bold text-primary">
          {q.total} <span className="text-2xs">{q.currency === "EGP" ? "ج.م" : q.currency}</span>
        </span>
      </div>

      {quantity > 1 && (
        <p className="mt-1.5 text-2xs text-muted-foreground">الأسعار محسوبة على {quantity} قطعة.</p>
      )}
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-mono font-bold text-foreground" : "font-mono text-foreground"}>{value}</dd>
    </div>
  );
}

/**
 * Reception-facing wording for each refusal.
 *
 * The domain error messages are written for developers and logs; a receptionist
 * standing at a counter needs to be told what to do next. Anything not listed
 * here falls back to the domain message rather than being swallowed, so a new
 * refusal can never render as a blank panel.
 */
const ARABIC_REJECTIONS: Readonly<Record<string, string>> = {
  WIDTH_ABOVE_MAXIMUM: "العرض أكبر من أقصى عرض متاح في المصنع — ارفع استثناءً للمدير.",
  HEIGHT_ABOVE_MAXIMUM: "الطول أكبر من الحد الأقصى المسموح به.",
  RATE_OUT_OF_BAND: "سعر المتر المربع خارج النطاق المسموح به.",
  INVALID_DIMENSIONS: "أدخل العرض والطول بأرقام صحيحة أكبر من صفر.",
  FINISHING_UNAVAILABLE: "إحدى خدمات التشطيب المختارة غير متاحة.",
  INVALID_WIDTH_LADDER: "إعداد عروض الرول غير صحيح — راجع مدير النظام.",
};
