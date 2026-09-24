// diff.ts — Pure specification diffing between SpecSnapshots.
// contracts/spec-diff.md (specs/016-change-control/contracts/spec-diff.md).

import {
  SPEC_FIELDS,
  toSpecSnapshot,
  type SpecField,
  type SpecSnapshot,
} from "./specFields";

type SpecValue<F extends SpecField> = SpecSnapshot[F];

/** Discriminated union keyed by `field`: narrowing on `field` narrows before/after. */
export type SpecFieldChange = {
  [F in SpecField]: {
    readonly field: F;
    readonly kind: "ADDED" | "REMOVED" | "CHANGED";
    readonly before: SpecValue<F>;
    readonly after: SpecValue<F>;
  };
}[SpecField];

/**
 * Computes the difference between two specification snapshots.
 * - Pure: no I/O, no mutation of inputs.
 * - Result in exact SPEC_FIELDS order.
 * - Decimals canonicalized (e.g. "1.50" === "1.5").
 * - Returns empty array if snapshots are identical.
 */
export function diffSpecSnapshots(
  before: SpecSnapshot,
  after: SpecSnapshot,
): readonly SpecFieldChange[] {
  const normBefore = toSpecSnapshot(before);
  const normAfter = toSpecSnapshot(after);

  const changes: SpecFieldChange[] = [];

  for (const field of SPEC_FIELDS) {
    const b = normBefore[field];
    const a = normAfter[field];

    if (b === a) {
      continue;
    }

    let kind: "ADDED" | "REMOVED" | "CHANGED";
    if (b === null && a !== null) {
      kind = "ADDED";
    } else if (b !== null && a === null) {
      kind = "REMOVED";
    } else {
      kind = "CHANGED";
    }

    // Type assertion is safe because field, b, a are from the corresponding SpecSnapshot[F]
    changes.push({
      field,
      kind,
      before: b,
      after: a,
    } as SpecFieldChange);
  }

  return changes;
}
