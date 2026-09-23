// selfReview.ts — pure isSelfReview() comparison, split out from guards.ts
// so it has a database-free unit test (tests/unit/review-rework.test.ts,
// Foundational T007) — mirrors 012's suggestDesigner()/getEligibleDesigners()
// split (a pure decision function separated from its DB-backed caller).

export function isSelfReview(currentVersionUploadedById: string | null, actorUserId: string): boolean {
  return currentVersionUploadedById !== null && currentVersionUploadedById === actorUserId;
}
