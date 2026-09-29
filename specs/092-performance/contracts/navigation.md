# Contract: Overlay-Free Navigation

Feature: 092-performance · Date: 2026-09-29 · Status: Draft

Owner: 092. Consumers: all navigation mechanisms — `Link`, `router.push` (command bar), the board controller, raw internal anchors. Guarantees uniform navigation behavior across mechanisms; no mechanism MAY have private loading or reload semantics.

## 1. Uniform overlay-free navigation (NB-001 / NB-002)

1.1 All in-app navigation mechanisms (Link, `router.push`, board controller navigation) MUST behave uniformly: no blocking overlay and no document reload for same-origin destinations (NB-001).

1.2 No mechanism MUST arm, show, or hold an opaque input-blocking overlay on navigation, and no minimum-visible hold or exit animation MAY run after the target route renders (FR-001, PR-001).

1.3 Hash-only and same-path navigations MUST never produce loading UI (NB-002).

1.4 Any navigation state that remains MUST be driven by actual route commitment, not pointer-down anticipation, and MUST NOT gate rendering or input (NB-003).

1.5 Existing soft-navigation behavior for every other route (Link-based, prefetch) MUST stay as-is (NB-005).

1.6 No internal navigation link MAY trigger a full document request — raw `<a href>` count for internal routes MUST be 0 (PR-007).

## 2. Board `navigate` option (spec contract §6)

2.1 `createBoardController(..., { navigate })` MUST receive a client-navigation implementation from `BoardProvider` (`href` → soft navigation) (FR-024, contract §6).

2.2 The board SCREEN drop's navigation MUST be a client-side (soft) navigation — zero `window.location.href` assignments, zero document unload/reload (FR-024, PR-006, AC-018).

2.3 The destination MUST arrive unchanged: path AND query parameters exactly as the drop policy built them (e.g. `/pricing?workItem=…`) (NB-004, AC-018).

2.4 The default `window.location.href` fallback in `createBoardController` MUST be removed or made unreachable in production paths (contract §6).

2.5 When a drop policy declines (no navigation required), behavior MUST be unchanged — only the `navigate` implementation changes (spec US6 AS3, Edge Cases).

2.6 `ScreenDropPolicy` (href construction) MUST remain untouched; destination authorization is unchanged — a soft nav hits the same server page with the same session (FR-024, SEC-001).

## 3. Raw-anchor and dead-link rules (FR-031)

3.1 Internal navigation anchors in `finance/daily-cash` and `admin/audit` (clear-filter) MUST use client-side navigation via `next/link` `<Link>`, preserving hrefs including query strings (FR-031, AC-023).

3.2 `IconRail` MUST NOT link to non-existent routes: the dead `/orders` and `/settings` entries MUST be removed (routes are not built — spec Assumptions), never left as silent 404s (FR-031, AC-023).

3.3 No low-risk cleanup under this contract MAY alter the semantics of the surface it touches (FR-033).

## 4. Optional route-progress indicator (FR-004)

4.1 A non-blocking route-progress indicator MAY be provided, but only with product sign-off, and it is NOT required for acceptance (FR-004).

4.2 If built, it MUST NOT intercept input (`pointer-events: none`), MUST NOT cover content, and MUST NOT be full-screen (FR-004).

4.3 If built, it MUST be driven by actual route commitment, not pointer-down anticipation (NB-003), and MUST NOT be armed during boot — boot loading remains the only blocking treatment (FR-002, Q1).

4.4 If sign-off is withheld, the indicator MUST be absent entirely (tasks T010).

## Verification

| Clause        | Acceptance Criteria / Spec refs |
| ------------- | ------------------------------- |
| 1.1, 1.2      | AC-001, PR-001, NB-001          |
| 1.3           | AC-001, NB-002                  |
| 1.4, 1.5      | NB-003, NB-005                  |
| 1.6           | PR-007, AC-023                  |
| 2.1, 2.2, 2.4 | AC-018, PR-006                  |
| 2.3           | AC-018, NB-004                  |
| 2.5, 2.6      | spec US6 AS3; AC-018            |
| 3.1           | AC-023                          |
| 3.2           | AC-023                          |
| 3.3           | FR-033; AC-025                  |
| 4.1–4.4       | FR-004; not part of acceptance  |
