// Auth actor shape stub — pending 001-identity-access-audit (PRI-5).
//
// This feature (002) only defines the call shape so `src/server/core/**` and
// downstream features can type against it; the real implementation of
// `getActor()` (session lookup, role/department resolution) belongs to 001.

// eslint-disable-next-line no-restricted-imports -- the src/server/core public barrel (index.ts) is not created until T038 (Phase 6); this deep import of the branded-ID type is the sanctioned exception until then.
import type { UserId } from "~/server/core/ids";

export interface Actor {
  readonly id: UserId;
  readonly roles: readonly string[];
  readonly departmentIds: readonly string[];
}

// Ambient declaration only — no body. There is genuinely no implementation
// yet; this must not fabricate one that silently "works".
export declare function getActor(): Promise<Actor>;
