# Contract: Width Rounding + Pricing Quote

Pure server functions (no I/O) plus one transactional quote persister.

```ts
resolveProductionWidth(customerWidthCm: DecimalLike): 80|110|150|210|260|270|320
// throws INVALID_WIDTH (≤0 / non-numeric) or WIDTH_ABOVE_MAXIMUM (>320)

quoteRollItem(input: {
  customerWidthCm: DecimalLike; heightM: DecimalLike; quantity: number;
  basePricePerM2: DecimalLike; finishingCodes: string[]; // e.g. ["SULFAN"]
}): {
  productionWidthCm: number; areaM2: Decimal; baseTotal: Decimal;
  finishings: { code: string; ratePerM2: Decimal; amount: Decimal }[];
  finishingTotal: Decimal; finalTotal: Decimal; // whole-EGP rounded
  breakdown: object; // inputs, table version, rates, rounding steps
}
```

Rules:
- Width table version pinned in breakdown; area uses production width only: `area = (prodCm/100) × heightM × qty` in Decimal.
- `80 ≤ basePricePerM2 ≤ 120` else `PRICE_OUT_OF_RANGE`; `0 < heightM ≤ 50` else `INVALID_HEIGHT`; Sulfan rate read from FinishingService effective row (seed 90), frozen into snapshot.
- Final rounding: intermediates full precision, final total to nearest whole EGP (051 rule).
- `persistQuote(tx, workItemId, quote, actor)` writes WorkItem snapshot columns + `WorkItemPrice` (source LIST/CUSTOMER_RULE/MANUAL) + `WorkItemFinishing` rows + audit, atomically. Later list changes never mutate these rows.

Vector (must all pass): 75→80, 80→80, 81→110, 145→150, 150→150, 151→210, 250→260, 265→270, 271→320, 320→320, 321→WIDTH_ABOVE_MAXIMUM; pricing example 145cm×2m×1 @100 + Sulfan → 300 + 270 = 570.
