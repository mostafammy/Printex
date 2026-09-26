# Contract: Delivery Pricing Gate

## Provider binding

051 implements and binds the port exported by 015:

```ts
export type PricingResponsible = {
  readonly label: string;
  readonly userIds: readonly string[];
};

export type PricingStatus =
  | { readonly status: "RESOLVED" }
  | { readonly status: "NOT_REQUIRED" }
  | {
      readonly status: "PENDING";
      readonly waitingSince: Date | null;
      readonly responsible: PricingResponsible;
    };

export interface PricingGatePort {
  getPricingStatus(workItemIds: readonly string[]): Promise<ReadonlyMap<string, PricingStatus>>;
}
```

051 binds once at module load through `bindPricingGatePort`. The implementation must return an entry for every requested WorkItem ID and read committed data only.

## Semantics

- A current PRICED WorkItem returns `RESOLVED`.
- An explicitly non-billable/non-required WorkItem returns `NOT_REQUIRED` only when the 015 contract says it is required for delivery exclusion.
- PENDING and DISPUTED return `PENDING` with `waitingSince` and responsible pricing users.
- Missing provider data fails closed as PENDING.

015 owns the guard on `READY_FOR_COLLECTION -> DELIVERED` and maps any unresolved required status to `PRICING_UNRESOLVED`. 051 MUST NOT register a second guard on that edge and MUST NOT write WorkItem workflow state.
