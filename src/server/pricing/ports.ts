export type PricingResponsible = {
  readonly label: string;
  readonly userIds: readonly string[];
};

export type PricingGateStatus =
  | { readonly status: "RESOLVED" }
  | { readonly status: "NOT_REQUIRED" }
  | {
      readonly status: "PENDING";
      readonly waitingSince: Date | null;
      readonly responsible: PricingResponsible;
    };

export interface PricingGatePort {
  getPricingStatus(workItemIds: readonly string[]): Promise<ReadonlyMap<string, PricingGateStatus>>;
}

const failClosedResponsible: PricingResponsible = {
  label: "Pricing review required",
  userIds: [],
};

const failClosedPort: PricingGatePort = {
  async getPricingStatus(workItemIds) {
    return new Map(
      workItemIds.map((workItemId) => [
        workItemId,
        {
          status: "PENDING" as const,
          waitingSince: null,
          responsible: failClosedResponsible,
        },
      ]),
    );
  },
};

let pricingGatePort: PricingGatePort = failClosedPort;

export function bindPricingGatePort(port: PricingGatePort): void {
  if (pricingGatePort !== failClosedPort && pricingGatePort !== port) {
    throw new Error("PricingGatePort is already bound");
  }
  pricingGatePort = port;
}

export function getPricingGatePort(): PricingGatePort {
  return pricingGatePort;
}

export function getFailClosedPricingGatePort(): PricingGatePort {
  return failClosedPort;
}