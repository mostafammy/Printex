// ports.ts — Cross-team ports for 016 Order Change Control.
// contracts/events-and-ports.md §2 (specs/016-change-control/contracts/events-and-ports.md).

import type { Prisma } from "../../../generated/prisma";

export type LateCancellationCost = {
  readonly lateCancellationId: string; // source record (PRD §30 traceability)
  readonly workItemId: string;
  readonly orderId: string;
  readonly amount: string; // exact decimal string, >= 0, 2 dp
  readonly currency: string; // "EGP" today (LateCancellation.currency)
  readonly reason: string;
  readonly recordedById: string;
  readonly recordedAt: Date;
};

export interface DirectCostPort {
  recordLateCancellationCost(
    tx: Prisma.TransactionClient,
    cost: LateCancellationCost,
  ): Promise<void>;
}

export const noopDirectCostPort: DirectCostPort = {
  async recordLateCancellationCost(): Promise<void> {
    // No-op until 052 Finance installs its adapter
  },
};

let currentDirectCostPort: DirectCostPort = noopDirectCostPort;

/** Called once by 052 Finance at module load. */
export function setDirectCostPort(port: DirectCostPort): void {
  currentDirectCostPort = port;
}

/** Internal accessor used by cancelAfterProductionStarted. */
export function getDirectCostPort(): DirectCostPort {
  return currentDirectCostPort;
}

/** Test-only reset hook. Not exported from barrel. */
export function __resetDirectCostPortForTests(): void {
  currentDirectCostPort = noopDirectCostPort;
}
