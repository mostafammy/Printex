"use client";

import { useEffect, useState } from "react";

export type PriceTierFormValue = {
  minimumQuantity: number;
  maximumQuantity: number | null;
  basePrice: string;
};

type TierRowsProps = {
  readonly labels: {
    min: string;
    max: string;
    price: string;
  };
};

export function PriceListTierRows({ labels }: TierRowsProps) {
  const [tiers, setTiers] = useState<Array<{
    minimumQuantity: string;
    maximumQuantity: string;
    basePrice: string;
  }>>([
    { minimumQuantity: "1", maximumQuantity: "", basePrice: "" },
    { minimumQuantity: "", maximumQuantity: "", basePrice: "" },
    { minimumQuantity: "", maximumQuantity: "", basePrice: "" },
  ]);

  const serialized = tiers.flatMap((tier) => {
    if (!tier.minimumQuantity || !tier.basePrice) return [];
    return [{
      minimumQuantity: Number(tier.minimumQuantity),
      maximumQuantity: tier.maximumQuantity ? Number(tier.maximumQuantity) : null,
      basePrice: tier.basePrice,
    } satisfies PriceTierFormValue];
  });

  useEffect(() => {
    // The server action reads this hidden field; the browser never calculates prices.
    const input = document.querySelector<HTMLInputElement>("#tiers-json");
    if (input) input.value = JSON.stringify(serialized);
  }, [serialized]);

  return (
    <>
      {tiers.map((tier, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <span className="w-6 text-xs font-medium text-muted-foreground">{index + 1}.</span>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {labels.min}
            <input
              name={`tierMin_${index}`}
              type="number"
              min="1"
              required={index === 0}
              value={tier.minimumQuantity}
              onChange={(event) => setTiers((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, minimumQuantity: event.target.value } : row))}
              className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {labels.max}
            <input
              name={`tierMax_${index}`}
              type="number"
              min="0"
              value={tier.maximumQuantity}
              onChange={(event) => setTiers((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, maximumQuantity: event.target.value } : row))}
              className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
              placeholder="∞"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {labels.price}
            <input
              name={`tierPrice_${index}`}
              type="number"
              min="0.01"
              step="0.01"
              required={index === 0}
              value={tier.basePrice}
              onChange={(event) => setTiers((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, basePrice: event.target.value } : row))}
              className="w-32 rounded-md border border-input bg-background px-2 py-1 text-sm"
              placeholder="EGP"
            />
          </label>
        </div>
      ))}
      <input type="hidden" name="tiers" id="tiers-json" value={JSON.stringify(serialized)} readOnly />
    </>
  );
}
