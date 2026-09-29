# Contract: Notification Targeted Refresh

Feature: 092-performance · Date: 2026-09-29 · Status: Draft

Owner: 092, on top of 053's stream contract (poll interval, SSE transport, error surface stay as 053 defines them). Consumers: `NotificationBell`, `notification-list.tsx`, shell layout, `notifications/actions.ts`. This contract changes how the bell gets data, never how notifications are created or authorized.

## 1. Targeted re-read payload and prop (spec contract §3, Clarifications Q2)

1.1 The bell MUST obtain count + first page from a server-side targeted re-read scoped to the calling user only (FR-020).

1.2 The payload MUST be `{ count: number; rows: NotificationView[] }` — the same shape semantics the layout already renders (Key Entities — NotificationView).

1.3 The `revalidate` prop on `NotificationBell` (and `notification-list.tsx` where applicable) MUST have type `() => Promise<{ count: number; rows: NotificationView[] }>` — widened from `Promise<void>` (Clarifications 2026-09-29 Q2, FR-020).

1.4 The bell MUST set its local `count`/`rows` state from the prop's return value; the return value is the only delivery channel for a successful re-read (Q2).

1.5 The re-read MUST be a **no-input server action in `src/app/(shell)/notifications/actions.ts`** (research Decision: bell re-read transport — a POST can never be HTTP-cached, FC-004 structurally); no GET route handler. It authenticates like every other server entry point and introduces no new auth mechanism (TR-006).

1.6 The re-read MUST be computed fresh per call — server-side on every invocation, never a stale cache serving as authority (FC-004, FC-005).

## 2. No route-tree re-execution (FR-019)

2.1 Passive refresh triggers — poll tick (15 s), SSE signal, tab refocus — MUST NOT call `router.refresh()` or otherwise re-execute the current route tree (FR-019, PR-005).

2.2 A successful targeted re-read MUST NOT trigger any route refresh; local state application is sufficient (Q2: `router.refresh()` not needed on any success path).

2.3 A poll response landing while a navigation is in flight MUST only update bell state; it MUST NOT cancel, restart, or re-run the in-flight route render (spec Edge Cases).

2.4 The poll interval, tab-refocus tick, and SSE transport semantics stay exactly as 053's client contract defines them (053 `notification-stream.md`).

## 3. Latest-response-wins ordering

3.1 When multiple targeted re-reads are in flight, the most recently _issued_ response's outcome MUST determine the applied state — a late-arriving older response MUST NOT overwrite newer local state (spec contract §3).

3.2 A superseded (stale) response MUST be discarded without error surfacing; only the outcome of the latest issued request MAY drive the error/retry surface (derived from contract §3 + FR-022).

## 4. Error and retry surface (FR-022)

4.1 A failed targeted re-read MUST surface the existing inline error + retry affordance (FR-022, AC-016).

4.2 Retry MUST re-attempt the targeted read only — never a route refresh as fallback (FR-022).

4.3 Polling MUST continue while an error is shown (FR-022, AC-016).

## 5. Mark-read stays server-authoritative (FR-021)

5.1 `markRead` / `markUnread` / `markAllRead` MUST remain server actions and stay the authority for read state, with unchanged authorization and audit behavior (FR-021, AC-015, constitution V).

5.2 After a mark action, the bell count MUST come from an immediate server-authoritative re-read through the same targeted path (Q2 mark-read behavior) with zero route-tree re-execution.

## 6. Invalidation scoping (spec contract §7)

6.1 Notification actions MUST NOT call `revalidatePath("/", "layout")` (FR-023, AC-017).

6.2 Invalidation MUST be scoped to what the action actually changed: `revalidatePath("/notifications")` per 053 `contracts/ui.md` — plus a bell-specific tag/fetch invalidation only if the re-read were cached, which it MUST NOT be (FR-023, FC-004).

6.3 Other routes' cached RSC payloads MUST survive a mark-read (AC-017).

## 7. Scoping and security (SEC-003)

7.1 The targeted re-read MUST authenticate the caller and scope rows to that caller exactly as `listNotifications`/`unreadCount` do today (SEC-003).

7.2 Another user's notifications MUST be unreachable through the re-read — covered by an explicit test (SEC-003).

7.3 No client-side authorization or client-computed permission state is introduced; the payload is display-only (SEC-004, FC-004).

## Verification

| Clause   | Acceptance Criteria / Spec refs         |
| -------- | --------------------------------------- |
| 1.1–1.4  | AC-014, FR-020, Clarifications Q2       |
| 1.5, 1.6 | TR-006, FC-004                          |
| 2.1–2.3  | AC-014, PR-005                          |
| 2.4      | AC-015 (053 suite unchanged)            |
| 3.1, 3.2 | spec contract §3 (latest response wins) |
| 4.1–4.3  | AC-016                                  |
| 5.1, 5.2 | AC-015, FR-021                          |
| 6.1–6.3  | AC-017, FR-023                          |
| 7.1–7.3  | SEC-003, SEC-004; test T027b            |
