/**
 * DropPolicyResolver: maps move kind to DropPolicy using an open/closed Map registry.
 * (contracts/board-engine.md §Drop policies, plan.md S1, S2-O, S3)
 */

import type { BoardCard, MoveOption } from "../types";
import type { DropPolicy } from "./DropPolicy";

export class DropPolicyResolver {
  private readonly policies = new Map<string, DropPolicy>();

  register(kind: string, policy: DropPolicy): void {
    this.policies.set(kind, policy);
  }

  resolve(option: MoveOption, _card?: BoardCard): DropPolicy {
    const policy = this.policies.get(option.kind);
    if (!policy) {
      throw new Error(`No DropPolicy registered for move kind: ${option.kind}`);
    }
    return policy;
  }
}
