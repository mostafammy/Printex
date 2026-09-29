# Contract: Loading & Streaming Boundaries

Feature: 092-performance · Date: 2026-09-29 · Status: Draft

Owner: 092. Consumers: every `(shell)` route (inherited), order detail, customer profile, boot loader. Guarantees shape and behavior only — no implementation beyond the named file paths and component names (house rule).

## 1. Shell loading boundary

1.1 The file `src/app/(shell)/loading.tsx` MUST exist and is the single loading surface inherited by every route under `(shell)` (spec contract §2, FR-005).

1.2 On any soft navigation into a `(shell)` route, the boundary's skeleton MUST paint without waiting for the target page's data resolution (SR-001); the previous route MUST NOT remain frozen pending the full target payload.

1.3 The boundary skeleton MUST be marked `aria-busy` and MUST contain zero operational data — no counts, names, rows, prices, or placeholder values resembling real records (SR-003, Clarifications 2026-09-29 Q5).

1.4 The boundary MUST NOT introduce an `aria-live` region, MUST NOT move or hold focus, and MUST NOT announce route changes by any means beyond `aria-busy`. Existing landmarks and the skip link remain the sole assistive-navigation affordances (SR-003, Q5).

1.5 The boundary MUST NOT be input-blocking: no opaque full-screen layer, no pointer-events capture, no z-index overlay semantics (FR-003).

1.6 Skeleton markup MUST use the shell's existing styling conventions and logical properties (RTL-safe), per constitution IX / BC-005.

## 2. Boot vs. navigation split

2.1 The initial application boot loading experience MUST be preserved and MUST be driven only by the boot signal (FR-002, AC-002).

2.2 Client-side navigation MUST NOT arm, show, or hold any loading overlay; no pointer-down anticipation, no minimum-visible hold, no exit animation after the target route renders (FR-001, PR-001).

2.3 Boot and navigation MUST NOT share an armed path: deleting or disabling the navigation path MUST leave the boot phase machine byte-identical (FR-002).

2.4 Navigation MUST NOT be replaced by any other input-blocking full-screen loading layer (FR-003).

2.5 Hash-only and same-path navigations (e.g. the `#main-content` skip link) MUST produce no loading UI of any kind (NB-002).

2.6 An optional non-blocking route-progress indicator MAY exist (FR-004). If present it MUST: not intercept input (`pointer-events: none`), not cover content, not be required for acceptance, and be gated on product sign-off. It MUST NOT be built unless that sign-off exists.

## 3. Suspense sites

3.1 The following MUST render inside `<Suspense>` with skeleton fallbacks, so each streams independently of its parent paint (FR-006, SR-002):
a. `<OrderFinancePanel>` on `orders/[orderId]`;
b. each `<SpecHistory>` row inside the order detail work-item list;
c. `<CustomerBalanceTab>` on `customers/[id]`.

3.2 Each fallback MUST be an honest skeleton: no stale operational data (previous route content, cached queue rows, cached prices) presented as current (FR-007).

3.3 Fallbacks MUST NOT receive data props whose values could render as if live; fallback content is static skeleton markup only (FR-007).

3.4 Streaming MUST NOT change what data is authorized: every streamed fragment MUST resolve under the same server-side `getActor`/`authorize` rules as an unsuspended render (SR-004).

3.5 Streaming MUST NOT alter result sets, values, or ordering of the data ultimately rendered (DF-005) — it changes only when each fragment paints.

3.6 Suspense scope is limited to the three sites named in 3.1 plus the shell boundary; other sections MAY be wrapped later only by a separate change, not required here (spec Assumptions — Suspense scope).

## Verification

| Clause        | Acceptance Criteria / Spec refs                                    |
| ------------- | ------------------------------------------------------------------ |
| 1.1, 1.2      | AC-003                                                             |
| 1.3, 1.4      | SR-003, Clarifications Q5; asserted by structure test (tasks T003) |
| 1.5, 2.2, 2.4 | AC-001, PR-001                                                     |
| 2.1, 2.3      | AC-002                                                             |
| 2.5           | NB-002; AC-001                                                     |
| 2.6           | FR-004; not part of acceptance                                     |
| 3.1, 3.3      | AC-004                                                             |
| 3.2           | FR-007; AC-004                                                     |
| 3.4           | SR-004; AC-006                                                     |
| 3.5           | DF-005; AC-010                                                     |
