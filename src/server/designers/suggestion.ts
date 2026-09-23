// Pure "lightest eligible designer" tie-break logic (spec.md FR-003).
// No DB access — callers assemble the candidate array, this just picks one.

export interface DesignerLoadCandidate {
  userId: string;
  name: string;
  activeWorkItemCount: number;
  /** Most recent moment this designer was assigned anything, or null if never. */
  lastAssignedAt: Date | null;
}

/**
 * Returns the userId of the candidate with the fewest activeWorkItemCount,
 * ties broken by earliest lastAssignedAt (nulls sort last — "never assigned"
 * is not "earliest"), then by name (data-model.md EligibleDesigner.isSuggested).
 * Returns null for an empty candidate list.
 */
export function suggestDesigner(candidates: readonly DesignerLoadCandidate[]): string | null {
  if (candidates.length === 0) return null;

  let best = candidates[0]!;
  for (const candidate of candidates.slice(1)) {
    if (isBetter(candidate, best)) {
      best = candidate;
    }
  }
  return best.userId;
}

function isBetter(a: DesignerLoadCandidate, b: DesignerLoadCandidate): boolean {
  if (a.activeWorkItemCount !== b.activeWorkItemCount) {
    return a.activeWorkItemCount < b.activeWorkItemCount;
  }

  const aTime = a.lastAssignedAt?.getTime();
  const bTime = b.lastAssignedAt?.getTime();
  if (aTime !== bTime) {
    if (aTime === undefined) return false;
    if (bTime === undefined) return true;
    return aTime < bTime;
  }

  return a.name < b.name;
}
