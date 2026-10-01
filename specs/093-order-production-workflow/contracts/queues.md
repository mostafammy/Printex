# Contract: Role-Scoped Queues

Each queue query enforces scope server-side; direct-by-ID fetch re-checks the same predicate (never relies on list filtering alone).

| Role | Sees | Direct-access rule |
|---|---|---|
| Reception | NEW items (own-created + all-new pool), exception tickets PENDING | May create; may release NEW→ASSIGNED only with assignee set |
| Designer | ASSIGNED + IN_DESIGN where `assigneeId = actor` | Only own items; upload + start + complete own items |
| Accountant | DESIGN_COMPLETED/WAITING_PRICING with file present | Approve → READY_FOR_PRODUCTION only (ROLL class, no review stage) |
| Head Designer | WAITING_REVIEW items only — **non-ROLL classes only** | Approve → APPROVED only if `actor ≠ uploader`; return with reason otherwise |
| Printer / production operator | READY_FOR_PRODUCTION + IN_PRODUCTION in own departments | Approved-file-only download; start/pause/complete per 014 |

Ordering: urgent-first then oldest (012/014 convention); revised-file badge when a newer approved version lands mid-production (014 US7). Unauthorized list or direct access returns empty/403 with no data leak and no state change.
