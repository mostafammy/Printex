# Printex Navigation Performance Investigation

> Status: investigation complete — **no production code was modified**. All findings below were produced by reading the codebase, tracing call chains, and running one production build. Findings marked CONFIRMED were personally traced through executing code paths with quoted evidence; nothing is labeled CONFIRMED on the basis of a function name.

---

## 1. Executive Summary

Slow navigation in Printex is **not primarily a database-slow-query problem**. It is the product of three compounding causes, in order of impact:

1. **A client-side loading overlay imposes a hard ~1.3–1.6 second perceived floor on every navigation.** `AppBootLoader` arms itself on `pointerdown` — *before routing even starts* — and the `LoadingExperience` phase machine enforces `SHOW_DELAY_MS (180) + MIN_VISIBLE_MS (500) + COMPLETE_MS (620)` even when the page has already rendered. A navigation that completes in 300 ms still looks like 1.3 s. This is self-inflicted, exists in production builds, and is invisible to any server-side profiling.

2. **Every authenticated navigation re-executes a sequential server-side query waterfall over a remote database.** The shell layout alone issues **5 queries in 3 sequential phases** (`getActor` → duplicate `db.user.findUnique` → notifications), and the actual `DATABASE_URL` points at **`aws-1-eu-west-1.pooler.supabase.com`** (a remote Supabase pooler) — not a localhost LAN Postgres. Every sequential round-trip pays network RTT; the layout's phases cannot overlap.

3. **There is no streaming boundary anywhere.** Zero `loading.tsx` files, zero `Suspense` in `(shell)`, zero `error.tsx`. Every route is `ƒ (Dynamic)` in the production build. The old page stays frozen until the *entire* RSC payload of the new page — including the layout's full query waterfall — has resolved.

On top of this, two routes amplify real server latency badly: **`/orders/[orderId]` is a 10-phase serial waterfall with an `await`-in-a-loop N+1** (~95 DB round-trips for a 5-item order), and **`/my-queue` issues ~50 queries** for phase durations. A **15-second notification poll calls `router.refresh()`**, re-running layout + page queries in the background while the user is trying to navigate. The **board's SCREEN drop does a full browser reload** via `window.location.href`.

**Critical/High findings: 4 CRITICAL, 8 HIGH.** The single highest-leverage fix is deleting the navigation-triggered loader (one edit, removes ~1.3 s from every click). The largest server-side fix is collapsing the shell layout's serial phases into one `Promise.all` and removing the duplicate user read.

---

## 2. Investigation Scope

**Inspected:**

- `package.json`, `next.config.js`, `tsconfig.json`, `.env.example`, the live `.env` (host only, credentials not reproduced)
- `src/app/**` — all 35+ `page.tsx`, all `layout.tsx`, all `route.ts`, all `actions.ts`/server actions; confirmed **zero** `loading.tsx`, **zero** `error.tsx`, **zero** `not-found.tsx`, **zero** `template.tsx`
- `src/server/**` — Prisma singleton, `getActor`, RBAC/authorize, notifications (bell, center, outbox processor, delay scheduler), finance summaries/profitability, pricing, designers queue/timers, production queue, review queue, orders, customers, files, changes
- `src/server/auth/**`, `src/server/better-auth/**` (config, server, client), `src/lib/auth/**` — Better Auth instance, session strategy, hooks
- `prisma/schema/*.prisma` (all 9 files), `prisma/migrations/**`, `prisma/schema/migrations/**`, `prisma/manual-sql/**` — declared vs actually-created indexes
- `src/components/**` — `AppBootLoader`, `LoadingExperience`, notification bell + stream hook, shell chrome (`IconRail`, `CommandBar`, `ShellHeader`), board controller/provider/policies
- `src/instrumentation.ts`, `src/env.js`, build output of `pnpm build` (succeeded, exit 0)
- Global searches: `window.location`, `router.refresh`, `revalidatePath`, `redirect(`, `Promise.all`, `include:`, `count(`, `findMany`, `cache(`, `force-dynamic`, `Suspense`, `Link` vs `<a>`
- No `middleware.ts` exists anywhere in the repo (verified)

**Not inspected / out of reach:**

- Live database: `prisma migrate status` failed with `P1001: Can't reach database server at aws-1-eu-west-1.pooler.supabase.com:5432`, so **actual indexes and `EXPLAIN` plans could not be verified against live data** (see §21)
- Browser DevTools network waterfall (no live app session during this investigation)
- Empirical dev-vs-prod navigation timing (build verified; runtime timing not measured)

**Method:** five parallel code audits (App Router tree, Prisma/waterfalls, auth/RBAC, schema/indexes, client-navigation mechanics), then adversarial first-hand re-verification of every CRITICAL claim against the actual files before including it in this report.

---

## 3. Architecture Relevant to Performance

**Stack reality check (installed versions differ from the brief):** `next@15.5.25`, `better-auth@1.7.5` (not 1.3), `@prisma/client@6.19.3` (not 6.6), React 19, TypeScript 5.8 strict.

**Request flow for an authenticated page:**

1. User clicks a `next/link` (or a raw `<a>`).
2. Client-side router issues an RSC payload fetch for the target route.
3. **`(shell)` layout executes on every such fetch** — it is a dynamic server component with no cache:
   - `getActor()` (React `cache()`-wrapped → once per request): Better Auth `auth.api.getSession({ headers })` → **DB round-trip #1** (session+user joined `findFirst`), then `getActorForSession` → **DB round-trip #2** (full RBAC graph: user + roles + permissions + extraPermissions + departments, one joined query). No Better Auth cookie cache is configured, so the session read always hits Postgres.
   - `db.user.findUnique({ where: { id: actor.userId }, select: { name, username } })` → **DB round-trip #3** — a duplicate: round-trip #1 already loaded the whole user row, and `getActor` discards `result.user` (`src/server/auth/getActor.ts:96-99`).
   - `Promise.all([unreadCount(actor), listNotifications(actor, …)])` → **DB round-trips #4 and #5** (parallel with each other, but sequential after #3).
4. The target `page.tsx` executes its own awaited data functions (each typically several queries; see §5), starting only after the layout's data phase resolves enough to render children.
5. The full RSC payload returns; React renders. Because there is **no `loading.tsx` and no `Suspense` anywhere in `(shell)`**, nothing paints until this completes.
6. Meanwhile, back on the client: `pointerdown` at step 1 already armed `AppBootLoader`; the loader's phase machine holds the overlay for `MIN_VISIBLE_MS` and `COMPLETE_MS` *after* the pathname commits.

**Data access:** hexagonal — Server Components/Server Actions → service modules under `src/server/*` → Prisma (`db`) repositories. RBAC is resolved once in `getActorForSession` into an in-memory `Set<Permission>` carried on the `Actor`; `authorize()` (`src/server/auth/authorize.ts:39-44`) is **pure set membership, 0 DB queries per check** — this part of the stack is healthy.

**Background load:** `src/instrumentation.ts` starts an outbox processor and a delay scheduler at boot (idempotent backstops re-called from the shell layout at `layout.tsx:65-66`) — both run interval ticks against the same remote DB pool.

**Prisma:** proper `globalThis` singleton (`src/server/db.ts:19-25`); query logging **off** by default, opt-in via `PRISMA_LOG_QUERIES=1` — safe to enable in dev. Note: the `globalForPrisma` assignment is skipped when `NODE_ENV === "production"` (`db.ts:25`), so only dev gets the re-import guard; in prod a module re-instantiation would create a second client (latent risk, not proven to occur).

**Deployment:** despite "local LAN" in the brief, the live `.env` points at **`aws-1-eu-west-1.pooler.supabase.com:5432`** (Supabase transaction pooler, EU-West). `.env.example` says localhost, but the actual environment does not. **Every sequential query pays internet-class RTT**, which is a multiplier on every waterfall below.

---

## 4. Navigation Lifecycle

A normal authenticated navigation (e.g. click "My Queue" from `/board`):

```
pointerdown on <a>                                   ← loader ARMED (before routing)
  └ AppBootLoader: setIsNavigating(true)             app-boot-loader.tsx:94
client router starts RSC fetch for /my-queue
  └ (no loading.tsx → NO shell paints; old page frozen)
shell layout re-executes (dynamic, every navigation):
  ├ await getActor()                                 layout.tsx:37   ← sequential
  │    ├ auth.api.getSession(headers)  → DB #1       (session row)
  │    └ db.user.findUnique(RBAC graph) → DB #2      (roles/perms/depts)
  ├ await db.user.findUnique(name,username) → DB #3  layout.tsx:68   ← DUPLICATE of #1
  └ await Promise.all([unreadCount → DB #4,
                       listNotifications → DB #5])   layout.tsx:79   ← parallel, after #3
page re-executes (after layout data resolves):
  └ MyQueuePage:
       ├ await getActor()                            ← memoized by React cache(), free
       ├ await Promise.all[getMyQueuePage, getMyQueueStats]   ← parallel ✓
       └ await Promise.all(rows.map(phaseDurations)) ← N+1: 2 queries × 25 rows = 50 queries
full RSC payload returned → React renders            ← first paint of new page
pathname commits → setIsNavigating(false)
  └ LoadingExperience: wait out remaining MIN_VISIBLE_MS (≤500ms)
       then COMPLETE_MS (620ms) exit animation        ← overlay still covers the page
user finally sees the page interactively             ≈ nav time + ~620–1120ms
```

**Blocking facts:**

- DB #1 → DB #2 → DB #3 → DB #4/#5 are **strictly sequential** and independent of each other (only the RBAC lookup needs the session's `userId`, which is available from DB #1's result — but #3 re-fetches what #1 already had).
- The page's phase 1 (`Promise.all`) cannot start until the layout's phases complete — the layout runs first in the render tree.
- The overlay duration is **independent of server speed**: even a 0 ms server response still pays 180 + 500 + 620 ms if the loader revealed itself.

---

## 5. Route/Data Fetch Map

All routes are `ƒ (Dynamic)` per the production build. **No route in `(shell)` has a `loading.tsx` or `Suspense` boundary.** "Layout queries" column = the same 5 queries (3 phases) for *every* row.

| Route | Layout Queries | Page Queries | Auth Checks | Sequential Queries | Suspense | Cache | Main Concern |
| ----- | -------------- | ------------ | ----------- | ------------------ | -------- | ----- | ------------ |
| `/` | — | `getSession` → `redirect(/board)` | 1 | serial | ✗ | none | extra redirect RTT after login |
| `/board` | 5 (3 phases) | `getActor` → `getBoardSnapshot` | 1 (memoized) | 2 serial phases | ✗ | none | waits full snapshot; queries themselves parallelized well |
| `/my-queue` | 5 (3 phases) | `getActor` → `Promise.all[page,stats]` → `map(phaseDurations)` | 1 (memoized) | 3 serial phases + **50-query N+1** | ✗ | none | `page.tsx:38-43` per-row 2-query loop |
| `/production` | 5 (3 phases) | `getActor` → `Promise.all[page,stats]` | 1 | serial + parallel | ✗ | none | fine |
| `/production/[workItemId]` | 5 (3 phases) | params → searchParams → `getActor` → `getJobCard` | 1 | 4 serial phases | ✗ | none | params/searchParams serialized with data |
| `/review` | 5 (3 phases) | `getActor` → `Promise.all[page,stats]` | 1 | serial + parallel | ✗ | none | **`fetchSortedReviewQueue` unbounded + full `transitions` include** |
| `/design/[workItemId]` | 5 (3 phases) | params → `workItem.findUnique` → `designVersion.findMany` | 1 | 3 serial phases | ✗ | none | 2nd query gated on 1st |
| `/reception` | 5 (3 phases) | `getActor` → `Promise.all[queue, stats]` | 1 | serial + parallel | ✗ | none | nested delayed-ids query |
| `/reception/new` | 5 (3 phases) | `getActor` → `Promise.all[customer, depts, productTypes]` | 1 | serial + parallel | ✗ | none | OK |
| `/orders/[orderId]` | 5 (3 phases) | **10+ serial phases** (see §6.4) | 1 (memoized) | **worst in app** | ✗ | none | **CRITICAL waterfall + await-in-loop N+1** |
| `/customers` | 5 (3 phases) | `findCustomers(limit 50)` — **no getActor** | 0 page-level | 1 | ✗ | none | 50 cards eager; no pagination |
| `/customers/[id]` | 5 (3 phases) | `getCustomer` → child `CustomerBalanceTab` (3 parallel, own `getActor`) | 1+1 | serial parent→child | ✗ | none | `orders: true` unbounded include |
| `/changes/[changeRequestId]` | 5 (3 phases) | params → `getActor` → `getChangeRequestDetail` → productTypeNames | 1 | 4 serial phases | ✗ | none | parent→child serialization |
| `/delayed` | 5 (3 phases) | `getActor` → `department.findMany` → `getDelayedWorkItems` | 1 | 3 serial | ✗ | none | dept list gates main query |
| `/finance/daily-cash` | 5 (3 phases) | `getActor` → timezone → `Promise.all[summary,payments]` | 1 | 3 serial | ✗ | none | **3 raw `<a href>` internal links** |
| `/finance/expenses` | 5 (3 phases) | `getActor` + `authorize` → `Promise.all[listExpenses]` | 1 | serial + parallel | ✗ | none | OK |
| `/notifications` | 5 (3 phases) | `getActor` → `listNotifications` | 1 | serial | ✗ | none | duplicates layout's own fetch |
| `/pricing` | 5 (3 phases) | `getActor` → `getPricingQueue` | 1 | serial | ✗ | none | OK |
| `/admin/audit` | 5 (3 phases) | `getActor` → `auditEvent.findMany(take 200, include actor)` | 1 | serial | ✗ | none | 200 joined rows, unpaginated; **raw `<a>`** |
| `/admin/users` | 5 (3 phases) | `getActor` → `Promise.all[4]` | 1 | serial + parallel | ✗ | none | OK |
| `/admin/health` | 5 (3 phases) | `getActor` → `getDatabaseHealth` (only `unstable_cache` in app) | 1 | serial | ✗ | `unstable_cache` | OK |
| `/login`, `/sign-up` | — | form-only | — | — | ✓ (`fallback={null}`) | none | only Suspense in the app |
| `/settings`, `/orders` | **route does not exist** | — | — | — | — | — | dead `IconRail` links → 404 |

Shell chrome (`ShellHeader`, `IconRail`, `CommandBar`) is pure `"use client"` receiving `actor` as a prop — **no server queries of their own** (good). The layout itself is the repeated cost.

---

## 6. Confirmed Bottlenecks

### 6.1 CRITICAL — Navigation overlay imposes a ~1.3–1.6 s perceived floor on every navigation

**Category:** Q (client-side UX machinery) / perceived latency · **Severity: CRITICAL** · **Confidence: CONFIRMED** (all four files read line-by-line)

**Evidence:**

`src/components/loading/app-boot-loader.tsx:65-99` — a `document` `pointerdown` listener arms the loader the instant any internal anchor is pressed, *before the click handler or router run*:

```ts
const anchor = target.closest("a[href]");
...
setIsNavigating(true);
navTimeoutRef.current = setTimeout(() => { ... setIsNavigating(false); }, NAV_FALLBACK_TIMEOUT_MS);
```

`src/components/loading/loading-config.ts:6-15` — non-negotiable constants:

```ts
export const SHOW_DELAY_MS = 180;    // reveal delay
export const AWAKENING_MS = 260;     // enter animation
export const MIN_VISIBLE_MS = 500;   // "eliminate visual flicker"
export const COMPLETE_MS = 620;      // exit animation
```

`src/components/loading/loading-experience.tsx:120-149` — when the route commits (`isLoading` → false), the machine **still waits out the minimum visible window**, then runs the full exit:

```ts
const remainingVisible = Math.max(0, MIN_VISIBLE_MS - elapsed);
minVisibleTimerRef.current = setTimeout(() => {
  transitionTo("completing");
  completeTimerRef.current = setTimeout(() => { transitionTo("hidden"); }, COMPLETE_MS);
}, remainingVisible);
```

`src/styles/globals.css:801-814` — the overlay is a **full-viewport, opaque, input-blocking layer**:

```css
.loading-container { position: fixed; inset: 0; z-index: 9999;
  background: var(--background); pointer-events: auto; user-select: none; }
```

**Blocking chain:** click → overlay armed at `pointerdown` → reveal at +180 ms → RSC returns (say 300 ms) → pathname commits → engine waits out `MIN_VISIBLE_MS` from reveal → 620 ms exit animation. **Worst floor = 180 + 500 + 620 = 1300 ms of enforced UI after routing starts;** navigations over ~680 ms still pay the 620 ms exit on top of actual latency. The new page renders *underneath* the opaque overlay the whole time. This is why navigation "feels" slow even where the server is fast — and it would not appear in any server log.

**Also confirmed (same mechanism):** the skip-link `<a href="#main-content">` (`shell-header.tsx:33`) passes the anchor filter and trips the full overlay for a zero-latency hash jump; `router.push` navigations (command bar) are *not* detected — inconsistent in both directions.

### 6.2 CRITICAL — Zero streaming boundaries: no `loading.tsx`, no `Suspense` in `(shell)`

**Category:** J (poor RSC streaming) · **Severity: CRITICAL** · **Confidence: CONFIRMED**

**Evidence:** glob `src/app/**/loading.tsx` → 0 results; `error.tsx` → 0; `not-found.tsx` → 0. Suspense appears exactly twice, both in `(auth)` with `fallback={null}` (`login/page.tsx:184`, `sign-up/page.tsx:70`) — **zero in `(shell)`**. Build output: every authenticated route is `ƒ (Dynamic)`.

**Blocking chain:** Next.js can only render a route's fallback shell if a `loading.tsx`/`Suspense` boundary exists. With none, a soft navigation keeps the previous page fully frozen until the layout waterfall (§4, 5 queries) **plus** the page's queries **plus** the full RSC serialize completes. Combined with §6.1, the user experiences: *old page → frozen → opaque spinner → whole new page pops in → spinner holds 620 ms more*. The pop-in is what reads as "slow" — actual latency and perceived latency are separate problems, and both are broken.

### 6.3 CRITICAL — Shell layout runs a 3-phase sequential query waterfall on every navigation, including a provable duplicate

**Category:** E (sequential waterfall) + F (duplicate query) + N (remote RTT) · **Severity: CRITICAL** · **Confidence: CONFIRMED**

**Evidence:** `src/app/(shell)/layout.tsx:37-82`:

```ts
actor = await getActor();                                       // phase 1: DB ×2 sequential
const user = await db.user.findUnique({                         // phase 2: DB #3
  where: { id: actor.userId }, select: { name: true, username: true },
});
const [unread, firstPage] = await Promise.all([                 // phase 3: DB #4 + #5 parallel
  unreadCount(actor), listNotifications(actor, { page: 1, pageSize: 10 }),
]);
```

The duplicate is provable: `getActor` (`src/server/auth/getActor.ts:94-99`) calls `auth.api.getSession`, which **returns the full user row**, then passes only `{ userId, expiresAt }` downstream — discarding `result.user`:

```ts
const result = await auth.api.getSession({ headers: await headers() });
if (!result) throw new UnauthenticatedError();
return getActorForSession({ userId: result.session.userId, expiresAt: result.session.expiresAt });
```

`getActorForSession` (`:46-57`) then re-queries the same user with `include: { roles: …, extraPermissions: true, departments: true }` — and `include` without `select` **already returns `name` and `username`**, which `:77` drops:

```ts
return { id: user.id, userId: user.id, roles, permissions, departmentIds };
```

**Blocking chain:** this runs on *every* authenticated navigation (dynamic segment, no cache). Three phases where one would do. Against the remote Supabase pooler (§8), each phase is a full RTT — the layout alone costs ~3 × RTT of serialized latency before the page's first query starts. `unreadCount` is a single indexed `count` (`center.ts:99`), `listNotifications` is one page query — those two are correctly parallel and constant-cost; the waste is the phasing and the duplicate.

**Secondary duplicate:** `getSession` is `cache()`-wrapped at `src/server/better-auth/server.ts:5-7`, but `getActor` bypasses it and calls `auth.api.getSession` directly — two independent request caches that can never share.

### 6.4 CRITICAL — `/orders/[orderId]`: 10-phase serial waterfall + await-in-loop N+1 (~95 round-trips)

**Category:** E + C · **Severity: CRITICAL** (scoped to one route, but it is the worst route in the app) · **Confidence: CONFIRMED**

**Evidence:** `src/app/(shell)/orders/[orderId]/page.tsx:452-537` — read line-by-line:

```ts
const actor = await getActor();                                   // :453
const detail = await getOrderDetail(actor, orderId);              // :454
const creationEvent = await db.auditEvent.findFirst({...});       // :456  ← independent of :454
const assigneeRows = await db.workItem.findMany({...});           // :471  ← needs only workItemIds from :454
const reworkCounts = await db.return.groupBy({...});              // :495
if (canAssignDesigner) {
  for (const wi of detail.workItems) {
    if (DESIGNER_ASSIGNABLE_STATES.has(wi.state)) {
      eligibleDesignersByWorkItem.set(wi.id, await getEligibleDesigners(actor, wi.id)); // :506 ← AWAIT IN LOOP
    }
  }
}
const departments = needsDepartments ? await db.department.findMany(...) : undefined;  // :522
const pendingChangeRequestByWorkItem = await findPendingChangeRequestIds(...);         // :530
```

`getEligibleDesigners` (`src/server/designers/assignment.ts:82-127`) issues 1 + 1 + **3 queries per candidate designer**. A 5-work-item order with 4 eligible designers each ≈ **68+ queries, only ~8 concurrent**. After all of that, two more async component layers render: `<OrderFinancePanel>` (`order-finance-panel.tsx:34`, 4 parallel queries) and N × `<SpecHistory>` (`spec-history.tsx:66,85` — 2 serial queries *each*, rendered sequentially inside `detail.workItems.map` at `:1059`).

**Blocking chain:** phases 454 → 456 → 471 → 495 → loop → 522 → 530 are serialized; several are independent (`:456` needs only `orderId`; `:471`/`:495` need only IDs from `:454`). With remote RTT each wasted serial phase is pure added latency, then SpecHistory multiplies it again.

### 6.5 HIGH — `/my-queue`: 2 × pageSize-query N+1 for phase durations

**Category:** C · **Severity: HIGH** · **Confidence: CONFIRMED**

**Evidence:** `src/app/(shell)/my-queue/page.tsx:38-43`:

```ts
const rowsWithDurations = await Promise.all(
  rows.map(async (row) => ({
    row,
    durations: await phaseDurations(actor, row.workItemId),
  })),
);
```

`phaseDurations` (`src/server/designers/timer.ts:165-199`) runs **2 sequential queries** (`phaseTiming.findMany` then `workItemTransition.findMany`). Page size 25 → **50 round-trips** as a third serial phase after `getActor` and the parallel page/stats fetch. The outer `Promise.all` overlaps them but the pool is shared with the background outbox/scheduler ticks and other tabs.

### 6.6 HIGH — Notification bell polls every 15 s and calls `router.refresh()`, re-running layout + page queries

**Category:** L (excessive refresh) · **Severity: HIGH** · **Confidence: CONFIRMED**

**Evidence:** `src/components/notifications/use-notification-stream.ts:38` `const DEFAULT_POLL_SECONDS = 15;` → `:71` `setInterval(tick, pollSeconds * 1000)`; `NotificationBell.tsx:58-66`:

```ts
const refresh = useCallback(async () => {
  try { await revalidate?.(); router.refresh(); setError(false); }
  catch { setError(true); }
}, [revalidate, router]);
```

`router.refresh()` re-executes the RSC tree for the current route: the shell layout's full 5-query waterfall **plus the page's queries** (on `/my-queue`, that re-triggers the 50-query N+1). The bell's `revalidate` prop is **never supplied** by the shell layout (`layout.tsx:97-102` passes only `initialCount/initialRows/markReadAction/markAllReadAction`), so the cheap targeted path is plumbed but unused.

**Blocking chain:** every 15 s (and on every tab refocus — `:137-143`), a full page re-render competes for the remote DB pool with whatever navigation the user just started. Navigation latency becomes *stochastic* — slow exactly when something else is refreshing.

### 6.7 HIGH — Marking one notification read invalidates the entire app's route cache

**Category:** L/I · **Severity: HIGH** · **Confidence: CONFIRMED**

**Evidence:** `src/app/(shell)/notifications/actions.ts:16-20`:

```ts
function revalidateAll(): void {
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
```

Called by all three actions (`markReadAction`, `markUnreadAction`, `markAllReadAction`). `revalidatePath("/", "layout")` drops **every route's** cached RSC payload. While these routes are dynamic anyway (§11), this guarantees no client route-cache reuse can ever accumulate (`staleTimes` is unset, default dynamic stale time = 0, so reuse was already minimal — but this makes it structurally impossible).

### 6.8 HIGH — Board SCREEN drop performs a full browser reload

**Category:** K (full-page navigation) · **Severity: HIGH** · **Confidence: CONFIRMED**

**Evidence:** `src/lib/board/createBoardController.ts:130`:

```ts
navigate: options.navigate ?? ((href) => { window.location.href = href; }),
```

`src/components/board/BoardProvider.tsx:29-37` is the sole production instantiation and passes **no** `navigate` — the fallback always wins. Trigger: `src/lib/board/policies/ScreenDropPolicy.ts:34-37` on the `WAITING_PRICING → READY_FOR_PRODUCTION` drag (`src/server/board/edges/pricing.ts:8-18`, `screenHref: /pricing?workItem=…`).

**Blocking chain:** drag card → `window.location.href = …` → document unload → full HTML download, JS re-parse, re-hydration, loader re-arms → **seconds**, vs. the ~300 ms a soft nav would cost. This is the only true full-reload navigation in the app, but it sits behind a drag gesture users perform regularly.

### 6.9 HIGH — Remote database contradicts the LAN premise; serial phases pay internet RTT

**Category:** N · **Severity: HIGH** · **Confidence: CONFIRMED** (host verified from `.env`; credentials not reproduced)

**Evidence:** live `DATABASE_URL` host = `aws-1-eu-west-1.pooler.supabase.com:5432` (+ pooler `:6543`, test DB `localhost:5432`). `.env.example` says `localhost:5432`.

**Why it matters:** the brief assumes LAN (~0.5–2 ms RTT); the reality is internet RTT (typically 10–100 ms depending on client location vs `eu-west-1`). Every *sequential* phase multiplies. The layout's 3 phases = ~3 RTT; `/orders/[orderId]`'s 10 serial phases = ~10 RTT *before* the N+1s. **This is the multiplier that turns "several queries" into "navigation feels slow."** It also amplifies the background outbox/scheduler ticks and the 15 s poll. (Per §21, actual RTT must be measured before quantifying.)

### 6.10 HIGH — Migration directory split: production may be missing the key performance indexes

**Category:** B · **Severity: HIGH** · **Confidence: LIKELY** (file layout confirmed; live DB unreachable — `P1001`)

**Evidence:** two divergent migration trees exist:

| `prisma/migrations/` (6) | `prisma/schema/migrations/` (4) |
|---|---|
| `0_init`, `customers`, `orders_reception`, `016_change_control`, `board_live…`, **`workitem_order_perf_indexes`** | `add_files_schema`, `pricing`, `finance`, `notifications` |

`package.json` sets `"prisma": { "schema": "prisma/schema" }` and `schema.prisma:9` enables `prismaSchemaFolder` → **`migrate deploy` resolves migrations relative to the schema dir → `prisma/schema/migrations`**, which does **not** contain `WorkItem_state_idx`, `WorkItem_assigneeId_state_idx`, `Order_customerId_idx`, or the change-control tables. `WorkItem_state_idx` exists only in `prisma/migrations/20260926140000_workitem_order_perf_indexes/migration.sql`. CI uses `prisma db push` (materializes the `.prisma` declarations), so **CI/`db push` environments are fully indexed while `migrate deploy` production may silently be missing three navigation-path indexes plus change-control tables**. Deployment docs (`specs/091-deploy-backup/contracts/compose.md:39`) specify `migrate deploy`.

### 6.11 HIGH — Review queue loads the entire backlog with full transition history

**Category:** C/D (unbounded + over-fetch) · **Severity: HIGH** · **Confidence: CONFIRMED**

**Evidence:** `src/server/review/queue.ts:37-49` — `findMany({ where: { state: "WAITING_REVIEW" }, include: { order: {…}, productType: {…}, transitions: { orderBy: { at: "desc" } } } })` — **no `take` on the queue or on `transitions`**. The consumer (`:63`) reads exactly one transition:

```ts
const enteredQueueTransition = wi.transitions.find((t) => t.to === "WAITING_REVIEW");
```

Whole per-row transition history fetched to `.find()` one element. Then paginated in memory (`paginateInMemory`, `:111`) — pagination is cosmetic. Grows monotonically with backlog.

### 6.12 HIGH — `getCurrentPrice` called in serial `for` loops across finance code

**Category:** C · **Severity: HIGH** · **Confidence: CONFIRMED**

**Evidence (three sites):**

- `src/server/finance/summaries.ts:80-81` — `for (const item of billable) { const price = await getCurrentPrice(item.id); }`
- `src/server/finance/profitability.ts:71-73` — same pattern
- `src/server/finance/payments.ts:201-202` — same pattern inside a `$transaction`

`getCurrentPrice` (`src/server/pricing/history.ts:40`) is at least one query per call → **W serial round-trips per order**, on `/orders/[orderId]` (via `OrderFinancePanel`) and finance pages — stacking on top of §6.4's waterfall.

---

## 7. Possible Secondary Bottlenecks

| # | Item | Why "possible" | Confidence |
|---|------|----------------|------------|
| 1 | `customers/[id]`: `include: { orders: true }` unbounded (`src/server/customers/service.ts:35-38`) — every column of every order ever placed; page reads 3 fields (`customers/[id]/page.tsx:25,30,33,39`) | Verified query shape; row count unknown without DB access | LIKELY |
| 2 | `Customer.normalizedName` btree useless for `LIKE '%x%'` search (`customers/service.ts:23`); would need `pg_trgm` GIN | Real gap, but search is a secondary path and it's an extension decision | LIKELY |
| 3 | Background outbox processor + delay scheduler (`src/instrumentation.ts`, `layout.tsx:65-66`) contending for the remote pooler | Intervals and tick query counts not fully quantified | POSSIBLE |
| 4 | Dev-mode penalty (`pnpm dev` = `next dev --turbo`, compile-on-demand per route, React dev overhead, StrictMode defaults) exaggerating the symptom | Real but secondary — §6.1 and §6.9 reproduce in production builds | CONFIRMED as present, POSSIBLE as magnitude |
| 5 | `staleTimes` unset → dynamic client route cache entries used once (`next.config.js` has no `experimental.staleTimes`) | Confirmed absence; actual hit-rate effect unmeasured | LIKELY |
| 6 | Login bounce: `router.push(callbackUrl="/")` → `/` runs `getSession` + `redirect("/board")` → second RSC request for the heaviest page (`login/page.tsx:56`, `app/page.tsx:5-19`) | Confirmed code path; only affects post-login | CONFIRMED (scope: post-login only) |
| 7 | Raw `<a href>` internal links bypassing the client router: `finance/daily-cash/page.tsx:89,128,134` (never imports `Link`), `admin/audit/page.tsx:206` | Confirmed; each is a full document request | CONFIRMED |
| 8 | `/admin/audit` renders 200 joined rows unvirtualized (`admin/audit/page.tsx:87-92`) | Admin-only, low traffic | CONFIRMED |
| 9 | Dead `IconRail` links `/orders` and `/settings` (`IconRail.tsx:56,129`) → client-router 404 with built-in error boundary (no custom `not-found.tsx`) | Confirmed routes don't exist; frequency unknown | CONFIRMED |
| 10 | `prisma` client not `globalThis`-cached in production (`db.ts:25` gated on `NODE_ENV !== "production"`) | Latent — requires a module re-instantiation to bite; not observed | POSSIBLE |

---

## 8. Database Query Analysis

**Client & connection:** proper singleton with `globalThis` (`db.ts:19-25`); no connection-string tuning (`connection_limit`/`pool_timeout` absent from `DATABASE_URL` → Prisma default pool). Query logging safely toggleable in dev: `PRISMA_LOG_QUERIES=1` (`db.ts:9-17`) — **recommended for §21 measurement**, no code change needed.

**N+1 / serial loops (all CONFIRMED):**

| Site | Pattern | Round-trips |
|---|---|---|
| `orders/[orderId]/page.tsx:506` | `await getEligibleDesigners()` in `for` loop; each call = 1+1+3×designers queries | ≈ 95 for a 5×4 order |
| `my-queue/page.tsx:41` | `phaseDurations` per row (2 queries each) | 50 per page |
| `finance/summaries.ts:81`, `profitability.ts:73`, `payments.ts:202` | `await getCurrentPrice(item.id)` in `for` loops | W per order, serial |
| `orders/[orderId]/page.tsx:1059` → `spec-history.tsx:66,85` | async `<SpecHistory>` per work item, 2 serial queries each, rendered sequentially in `.map` | 2W after everything else |
| `finance/summaries.ts:152` (`customerBalance` loop) | 1+2 queries per order | unbounded (customer page) |

**Over-fetch (CONFIRMED):**

- `review/queue.ts:47` — `transitions: { orderBy: { at: "desc" } }`, all history per row, one read (`:63`). Fix: `where + take: 1`.
- `customers/service.ts:37` — `orders: true` (all columns, all rows) for 3 fields. Fix: `select { id, number, createdAt, priority }` + `take`.
- `orders/[orderId]/page.tsx:471-490` — `assigneeRows` selects 16 fields from work items already inside `detail`; overlap with `getOrderDetail`'s own fetch is likely (partially verified — `getOrderDetail`'s exact select not fully audited).

**Counts:** `unreadCount` is a single indexed count (`center.ts:99`) — good. `listNotifications` runs `findMany + count + count` in one `Promise.all` (`center.ts:126`) — good. `admin/notifications` runs 4 parallel counts — acceptable. **No pathological count patterns found.**

**Transactions:** read-path rendering does not open transactions except `payments.ts` (a genuine write path). No read-only-transaction problem found.

**Pooler note:** `DATABASE_URL` targets Supabase's **transaction pooler (`:5432`)** — session-level features and long transactions are constrained there; also confirms the remote topology.

---

## 9. Database Index Analysis

**Prerequisite (do this first):** verify what production actually has —

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public'
  AND tablename IN ('workitem','order','notification','audit_event');
```

The migration-directory split (§6.10) makes index recommendations provisional until this runs.

**Query patterns found in `src/`** (board lane, snapshot, queues, notification center, order-detail audit probe) vs. indexes declared. Recommended, with justification:

### R1 — `WorkItem (state, createdAt, id)` — compound · **CONFIRMED missing as compound**

```sql
CREATE INDEX "WorkItem_state_createdAt_id_idx" ON "WorkItem" ("state", "createdAt", "id");
```

- **Serves:** `lanePage.ts:103` + `projection.ts:136` — filter `state` equality, order `createdAt asc, id asc`, with `skip/take`; fired in parallel across up to 14 lanes (`lanePage.ts:137`).
- **Why compound:** existing `WorkItem_state_idx` (if deployed) narrows the lane but forces Postgres to **sort the whole lane** before `skip/take` on every board paint ×14 lanes. The compound supplies the ordering directly and enables early skip termination. Trailing `id` guarantees total order for offset pagination.
- **Selectivity:** low on `state` (1/15) — acceptable: the win is *sort elimination*, not filtering. **Write cost:** moderate (state changes on every transition — hot path, but narrow columns and user-paced writes).

### R2 — `notification (userId, archivedAt, createdAt DESC)` · **CONFIRMED missing**

```sql
CREATE INDEX "Notification_userId_archivedAt_createdAt_idx"
  ON "notification" ("userId", "archivedAt", "createdAt" DESC);
```

- **Serves:** `center.ts:117-129` (`userId`, `archivedAt: null`, order `createdAt desc`, skip/take), `unreadCount` (`:99`), mark-all-read.
- **Why compound:** existing `..._userId_readAt_createdAt_idx` cannot serve the default list (which does **not** constrain `readAt`), so the bell's list **sorts the user's entire notification history every open**. `archivedAt IS NULL` appears on every read path and in no index.
- **Selectivity:** high (per-user; archival rare). **Write cost:** low.

### R3 — `audit_event (entityId, action, createdAt)` · **CONFIRMED missing**

```sql
CREATE INDEX "audit_event_entityId_action_createdAt_idx" ON "audit_event" ("entityId", "action", "createdAt");
```

- **Serves:** `orders/[orderId]/page.tsx:456-458` — runs on **every order-detail navigation**; no existing index leads with `entityId` (checked all three `audit_event_*` indexes in `0_init:370-376`).
- **Selectivity:** high (cuid). **Write cost:** moderate (hottest write table; 3 narrow columns, no FK compounding).

### R4 — `Order (priority, createdAt)` — **POSSIBLE, measure first**

Serves reception's whole-table sort (`orders/search.ts:194-210`). Sort-elimination only, no filter. Apply only if reception is measurably slow.

**Explicitly not recommended:** single-column indexes on boolean/low-cardinality flags (`isArchived`, `readAt`); extra FK indexes (audited — FKs used in `src/` are already covered); `(state, departmentId, createdAt)` for production queue (half the predicate is `departmentId IS NULL` OR-branch — index unusable; revisit only if measured). **Free win:** drop `FileObject_sha256_idx` (`add_files_schema/migration.sql:559`) — exact duplicate of the unique `FileObject_sha256_key` two lines above.

---

## 10. Authentication & RBAC Cost

**Per-navigation cost (CONFIRMED):** 3 sequential round-trips in the layout path —

1. `auth.api.getSession` → session `findFirst` joined with user (`getActor.ts:94`; Better Auth `internalAdapter.findSession`). No cookie cache configured (`config.ts` has no `session.cookieCache`) → always a DB hit.
2. `getActorForSession` → RBAC user graph query (`getActor.ts:46-57`). One joined query returns roles + permissions + extraPermissions + departments — **no separate role/dept queries exist**.
3. Layout's duplicate `db.user.findUnique` (`layout.tsx:68`) — `name`/`username` were already in memory at steps 1–2 and discarded (`getActor.ts:77,96-99`).

**What is healthy:**

- `getActor` is `React cache()`-wrapped (`getActor.ts:93`) → the page's own `getActor()` in the same render is **free**. This correctly collapses layout+page into one execution.
- **RBAC is 0-query:** `authorize()` (`src/server/auth/authorize.ts:39-44`) is pure `Set.has()` / `departmentIds.includes()` against the in-memory actor. 30+ call sites, zero DB.
- Shell chrome does **not** re-resolve auth: `IconRail`/`CommandBar` receive `actor` as a serialized prop (`layout.tsx:118`); zero `getActor`/`db.` calls inside them.
- Server actions containing `getActor` calls (10 of the 11 in `orders/[orderId]`) do not execute during navigation.
- Better Auth hooks (`config.ts:73-161`) fire only on sign-in/sign-out paths, **not** on `getSession`.

**What is wasteful:** the duplicate user read (#3, HIGH, §6.3) and the bypassed shared session cache: `getSession` is `cache()`-wrapped (`better-auth/server.ts:5`) but `getActor` calls `auth.api.getSession` directly — two request caches that never share. Serialized execution: #1 → #2 → #3 are strictly sequential where #2 needs only `userId` (available before #1 fully resolves? No — `userId` comes *from* #1's result, so #1→#2 is genuinely dependent; **#3 is fully independent given #1 and should be removed entirely, not parallelized**).

**No middleware exists** — session resolution begins only inside the RSC render (there is no earlier short-circuit; note: adding DB work in middleware would *add* latency on this stack, so "no middleware" is not itself a defect here).

**Verdict:** auth contributes **~2 necessary + 1 redundant** sequential round-trips per navigation — meaningful against remote RTT (§6.9), but it is *not* the dominant cost. The dominant costs are the overlay (§6.1) and the page-level waterfalls/N+1s (§6.4, §6.5).

---

## 11. Next.js App Router Analysis

**Render mode:** production build classifies **every authenticated route as `ƒ (Dynamic)`**; only `/login`, `/sign-up` and static assets are `○`. Routes are implicitly dynamic — no `force-dynamic` / `revalidate = 0` / `noStore` directives exist anywhere in pages (verified by grep); the dynamism comes from `headers()`/`cookies()` in the auth path, which is unavoidable for authenticated rendering.

**Route segment config:** none declared anywhere (`dynamic`, `revalidate`, `fetchCache`, `runtime` all absent from pages; `runtime`/`dynamic = "force-dynamic"` appear only on the two SSE handlers `api/board/stream` and `api/notifications/stream` — correct).

**Caching:**

- No `unstable_cache` / `revalidateTag` in page paths; the only `unstable_cache` in the app is `admin/health.ts:139`.
- `next.config.js` is minimal (22 lines): **no `experimental.staleTimes`, no `reactStrictMode` override, no `optimizePackageImports`**. Default `staleTimes.dynamic = 0` → client route-cache entries for dynamic routes are effectively single-use; prefetching of dynamic routes yields at most one stale-while-revalidate window.
- `revalidatePath("/", "layout")` on every notification interaction (§6.7) nukes whatever cache would accumulate.

**Prefetch:** all navigation uses `next/link` except the confirmed raw `<a>`s (§7.7) and the board reload (§6.8). No `prefetch={false}` anywhere. **But prefetch cannot help meaningfully**: prefetching a dynamic route with no `loading.tsx` does not let the router show anything early on click — it only warms the RSC payload. Without `loading.tsx`, even a prefetched payload still presents as old-page-frozen → pop-in.

**Streaming/Suspense:** absent across `(shell)` (§6.2). Nested `async` server components (`OrderFinancePanel`, `CustomerBalanceTab`, `SpecHistory`, `CustomerBalanceTab`'s internal `getActor`) serialize *behind* their parents with no boundary — classic §12 waterfalls.

**Client navigation:** primary nav is proper soft navigation (Link + router). Full reloads only via board SCREEN drop (§6.8) and raw `<a>`s (§7.7). `router.refresh()` frequency: 15 s poll + tab refocus + per mark-read (§6.6).

**Boot-time overhead:** `AppBootLoader` also gates *initial* boot with `isBooting` until double-`requestAnimationFrame` (`app-boot-loader.tsx:36-49`) — appropriate for first paint, but the same component conflates boot with navigation (§6.1).

---

## 12. Server Component Waterfalls

**(a) Layout waterfall (every navigation)** — §6.3: `getActor` (×2 sequential DB) → duplicate user read → parallel notifications. One `Promise.all` over all five would collapse 3 phases → 1 (minus the genuinely-dependent session→RBAC pair).

**(b) `/orders/[orderId]`** — §6.4: the flagship case. Serial phases at `:453 → :454 → :456 → :471 → :495 → :506(loop) → :522 → :530`. Independent pairs: `:456` ‖ `:454`; `:471` ‖ `:456` (both need `:454`'s output only for IDs — `:471` uses `workItemIds` from `:454`, so `:471` depends on `:454`; `:456` depends on neither). Then `<OrderFinancePanel>` (4 queries) renders *after* the page fully resolves, then N × `<SpecHistory>` (2 serial each) render sequentially inside `.map`.

**(c) Parent→child serialization** (CONFIRMED, no boundary):

- `customers/[id]/page.tsx:11` → `<CustomerBalanceTab>` (`customer-balance-tab.tsx:26`, 3 parallel + a redundant `getActor`)
- `changes/[changeRequestId]/page.tsx:137` → detail child components
- `work-items/[id]/files/page.tsx:56,80,103` — 4 serial phases
- `finance/daily-cash/page.tsx:32,37,39` — 3 serial phases
- `design/[workItemId]/page.tsx:95,119` — 3 serial phases
- `delayed/page.tsx:73,91` — dept list gates main query

**(d) Perceived vs actual:** wrapping (b)/(c) in `<Suspense>` converts *perceived* latency to ~0 for below-the-fold panels without changing raw DB time; the layout waterfall and N+1s are *actual* latency and need query-shape fixes.

---

## 13. Duplicate Work

| # | Duplicate | Evidence | Per-navigation cost |
|---|---|---|---|
| 1 | Layout re-reads user `name`/`username` already returned by `getSession` and discarded | `layout.tsx:68` vs `getActor.ts:94-99` (fields dropped at `:77`) | **+1 round-trip on EVERY authenticated navigation**, in the critical path |
| 2 | Two session caches that never share | `getSession` `cache()` at `better-auth/server.ts:5`; `getActor` bypasses it at `getActor.ts:94` | latent (1 shared lookup possible between `/`, `/auth/required`, shell) |
| 3 | `getActor` runs in layout AND most pages | collapsed correctly by `cache()` at `getActor.ts:93` | **0 — already fixed**, listed for completeness |
| 4 | `/notifications` page fetches the same first page as the layout bell | `notifications/page.tsx:22` + `layout.tsx:81` | +2 queries on that route only |
| 5 | `CustomerBalanceTab` calls `getActor()` although parent already did | `customer-balance-tab.tsx:26` | 0 (request-cached) but signals the pattern |
| 6 | `assigneeRows` re-fetches work-item fields likely already in `getOrderDetail` | `orders/[orderId]/page.tsx:471-490` | +1 query + payload overlap per order view |

**No root-layout duplication exists** — `src/app/layout.tsx` is a pure shell with Google font loading; all auth work lives in `(shell)/layout.tsx`.

---

## 14. Development vs Production Performance

**Production build verified:** `pnpm build` succeeded (exit 0). Route table: every authenticated route `ƒ (Dynamic)`; First Load JS 102–153 kB (shared chunk 102 kB) — **JS payload is not a navigation problem**.

**Dev-only penalties (present):** `pnpm dev` = `next dev --turbo` — per-route compile on first hit (first visit to `/orders/[orderId]` compiles it), React dev rendering, dev error overlays, source maps. `reactStrictMode` unset → **true in dev** (double-invoked effects; the `pointerdown` listener itself is idempotent, so no double-arm).

**Not dev-only (reproduce in `next start`):** the AppBootLoader floor (§6.1) is client code with hardcoded ms constants; the layout waterfall (§6.3) and N+1s run identically; the remote Supabase RTT (§6.9) is identical; the 15 s poll (§6.6) is identical; zero `loading.tsx` (§6.2) is a build-time property.

**Prisma query logging:** off by default in both modes (`db.ts:11-16`) — not a dev tax.

**Conclusion:** dev mode *adds* first-hit compile and React overhead and will exaggerate the first navigation to each route, but **the primary causes are production causes**. Do not attribute the symptom to `pnpm dev`.

---

## 15. Critical Path

Typical navigation, `/board` → `/my-queue`, production build, remote DB (measured constants are from code; RTT-labeled steps are illustrative pending §21):

```
[Client] pointerdown on sidebar Link
   └─ AppBootLoader arms overlay (0 ms)                       ← avoidable
[Client] RSC fetch starts (no loading.tsx → old page frozen)
[Server] (shell) layout re-executes:
   ├─ getActor → getSession        → DB round-trip  (1×RTT)   sequential
   ├─ getActor → RBAC user graph   → DB round-trip  (1×RTT)   sequential
   ├─ db.user.findUnique(name…)    → DB round-trip  (1×RTT)   DUPLICATE — avoidable
   └─ Promise.all[unreadCount, list]→ 2× DB          (1×RTT)   parallel after above
[Server] page executes:
   ├─ getActor()                             → cached, 0      ✓
   ├─ Promise.all[getMyQueuePage, stats]     → 1×RTT          parallel ✓
   └─ rows.map(phaseDurations)               → 50 queries     N+1 — avoidable
[Network] RSC payload → client render
[Client] pathname commit → overlay waits out MIN_VISIBLE remainder (≤500 ms)
   └─ + COMPLETE_MS 620 ms exit                       ← avoidable
────────────────────────────────────────────────────────────
Perceived = overlay-floor(≤1300 ms) + server(≈4 sequential RTT + 50 N+1 queries)
Blocking/duplicated/avoidable phases: duplicate user read, loader hold, N+1s, phasing
```

**Worst-case route** (`/orders/[orderId]`): same layout prefix, then ~10 sequential phases + ≈95 loop queries + finance `getCurrentPrice` loops + N × `SpecHistory` — **all sequential at the top, mostly-parallel only inside individual `Promise.all`s**.

---

## 16. Root Cause Ranking

| Rank | Issue | Severity | Confidence | Impact | Evidence |
| ---- | ----- | -------- | ---------- | ------ | -------- |
| 1 | AppBootLoader imposes ~1.3–1.6 s perceived floor on every nav | **CRITICAL** | CONFIRMED | Very High (perceived; every click) | `app-boot-loader.tsx:94`, `loading-config.ts:6-15`, `loading-experience.tsx:120-149`, `globals.css:801-814` |
| 2 | No `loading.tsx`/`Suspense` in `(shell)` → zero streaming, frozen page | **CRITICAL** | CONFIRMED | Very High (perceived; every route) | glob=0 files; build `ƒ (Dynamic)`; only Suspense in `(auth)` |
| 3 | Shell layout 3-phase serial waterfall incl. duplicate user read, every nav | **CRITICAL** | CONFIRMED | High (actual; every nav, ×remote RTT) | `layout.tsx:37,68,79`, `getActor.ts:77,94-99` |
| 4 | Remote Supabase DB (not LAN) multiplies every sequential phase | **CRITICAL** | CONFIRMED | High (actual; global multiplier) | `.env` host `aws-1-eu-west-1.pooler.supabase.com` |
| 5 | `/orders/[orderId]` 10-phase serial waterfall + await-in-loop N+1 (~95 q) | HIGH | CONFIRMED | High (that route) | `orders/[orderId]/page.tsx:453-537`, `assignment.ts:82-127` |
| 6 | `/my-queue` 50-query `phaseDurations` N+1 | HIGH | CONFIRMED | High (that route) | `my-queue/page.tsx:38-43`, `timer.ts:165-199` |
| 7 | 15 s bell poll → `router.refresh()` re-runs layout+page under the user | HIGH | CONFIRMED | High (stochastic nav latency) | `use-notification-stream.ts:38,71`, `NotificationBell.tsx:61` |
| 8 | Migration dir split → prod may lack `WorkItem_state_idx` etc. | HIGH | LIKELY | High if true (board/queue sorts) | `prisma/migrations/` vs `prisma/schema/migrations/`; `package.json` schema path |
| 9 | Review queue unbounded fetch + full `transitions` include | HIGH | CONFIRMED | Medium-High (grows with backlog) | `review/queue.ts:37-49,63,111` |
| 10 | `revalidatePath("/", "layout")` per notification click | HIGH | CONFIRMED | Medium (kills all cache reuse) | `notifications/actions.ts:16-20` |
| 11 | Board SCREEN drop full reload (`window.location.href`) | HIGH | CONFIRMED | Medium (one edge, seconds-long) | `createBoardController.ts:130`, `BoardProvider.tsx:29-37` |
| 12 | `getCurrentPrice` serial loops in finance (`summaries/profitability/payments`) | HIGH | CONFIRMED | Medium-High (order/finance pages) | `summaries.ts:81`, `profitability.ts:73`, `payments.ts:202` |
| 13 | Missing indexes R1–R3 (state+createdAt, notification list, audit probe) | MEDIUM | CONFIRMED (static) / needs live verify | Medium | §9 DDL vs query sites |
| 14 | Auth: duplicate user read + bypassed session cache (folded into #3) | MEDIUM | CONFIRMED | Medium | `getActor.ts:94` vs `better-auth/server.ts:5` |
| 15 | Un-suspended async children (finance panel, SpecHistory, balance tab) | MEDIUM | CONFIRMED | Medium (perceived) | `order-finance-panel.tsx:34`, `spec-history.tsx:66` |
| 16 | `customers/[id]` `orders: true` unbounded include | MEDIUM | CONFIRMED | Medium (that route) | `customers/service.ts:35-38` |
| 17 | Raw `<a>` internal links (daily-cash ×3, audit ×1) | MEDIUM | CONFIRMED | Low-Medium (4 links) | `daily-cash/page.tsx:89,128,134`, `audit/page.tsx:206` |
| 18 | No `staleTimes`; client dynamic route cache single-use | MEDIUM | LIKELY | Low-Medium | `next.config.js` absent keys |
| 19 | Dead `/orders`,`/settings` rail links → 404 + full error boundary | LOW | CONFIRMED | Low | `IconRail.tsx:56,129` |
| 20 | Dev-mode compile/render overhead exaggerating first hits | LOW | CONFIRMED present | Low-Medium (dev only) | `package.json` `dev` script |

**Counts: 4 CRITICAL, 8 HIGH, 6 MEDIUM, 2 LOW.**

---

## 17. Recommended Fixes

> **Caching policy for this report:** *request-level memoization* (React `cache()`, Promise coalescing within one render) is recommended freely — it cannot serve stale data across requests. *Persistent caching* (`unstable_cache`, `revalidateTag`, `staleTimes`) is recommended only where staleness is acceptable, and never for RBAC, workflow state, pricing, or queue contents.

### Fix A — Remove navigation-triggered overlay (Rank 1)

**Problem.** §6.1 — loader holds the screen ~1.3 s regardless of server speed.
**Evidence.** §6.1 file/line quotes.
**Why slow.** Opaque `fixed inset-0` overlay survives `MIN_VISIBLE_MS + COMPLETE_MS` after the new page already rendered.
**Recommended fix.** Delete the `isNavigating` arming path entirely — keep `isBooting` for first load only. If navigation feedback is wanted, use a non-blocking top progress bar (Next's built-in `nprogress`-style indicator) with a ≥2 s delay.
**Example.**

```tsx
// app-boot-loader.tsx — remove pointerdown effect; render:
return <>{children}<LoadingExperience isLoading={isBooting} /></>;
```

**Expected impact.** Very High (perceived, every navigation). **Risk.** None to correctness; loses anti-flicker polish on slow loads — that polish is the bug here. Design/product sign-off advisable since it's a deliberate UX feature; a safer variant is `MIN_VISIBLE_MS = 0` when `isNavigating` (keep 500 ms for boot).

### Fix B — Add `(shell)/loading.tsx` + Suspense around async children (Rank 2)

**Problem.** §6.2 — no streaming boundary anywhere.
**Evidence.** glob results; `layout.tsx:119-120` container shape.
**Why slow.** RSC payload must fully resolve before first paint of the new route.
**Recommended fix.** One `src/app/(shell)/loading.tsx` skeleton matching the `max-w-7xl` grid (inherited by all 25+ routes); wrap `OrderFinancePanel`, `CustomerBalanceTab`, `SpecHistory` instances, and per-lane board content in `<Suspense>` with lightweight fallbacks.
**Example.**

```tsx
// src/app/(shell)/loading.tsx
export default function Loading() {
  return <div className="mx-auto max-w-7xl space-y-4" aria-busy>
    <div className="h-8 w-48 animate-pulse rounded bg-muted" />
    <div className="h-64 animate-pulse rounded-lg bg-muted" />
  </div>;
}
```

**Expected impact.** Very High (perceived). **Risk.** None to data correctness; fallbacks must not mislead (use skeletons, not stale data).

### Fix C — Collapse the shell layout to a single parallel phase; drop the duplicate read (Ranks 3+14)

**Problem.** §6.3 — 3 sequential phases; `name`/`username` re-fetched.
**Evidence.** `layout.tsx:37-82`; `getActor.ts:77,94-99`.
**Why slow.** Runs on every authenticated navigation; 2 avoidable sequential RTTs against the remote pooler.
**Recommended fix.** (1) Widen `Actor` with `name`/`username` populated from `result.user` inside `getActor` (fields the session query already returned — display-only, **no authorization change**); delete `layout.tsx:68`. (2) Start `getActor()` and the notification pair concurrently where independent — notifications need `actor.userId`, so structure as one `Promise.all([getActor().then(a => Promise.all([unreadCount(a), list(a,{page:1,pageSize:10})])), …])` or simply: since `getActor` is `cache()`-d and the page also needs it, keep order but remove phase 2 entirely — net 4 queries in 2 phases.
**Example.**

```ts
// getActor.ts
export interface Actor { userId: string; name: string | null; username: string | null; /* … */ }
const result = await auth.api.getSession({ headers: await headers() });
return getActorForSession({ …, name: result.user.name, username: (result.user as any).username });

// layout.tsx — phase 2 deleted; phases 1 and 3 become:
const actor = await getActor();
const [unread, firstPage] = await Promise.all([unreadCount(actor), listNotifications(actor, {page:1,pageSize:10})]);
<ShellHeader userName={actor.name ?? "مستخدم برينتكس"} … />
```

Also make `getActor` delegate to the existing cached `getSession` (`better-auth/server.ts:5`) so both request caches become one.
**Expected impact.** High (every navigation). **Risk.** Very low — display fields only; keep RBAC reads authoritative per-request. Do **not** persistently cache the actor.

### Fix D — `/orders/[orderId]`: parallelize independent phases + batch the loop (Rank 5)

**Problem.** §6.4.
**Evidence.** `orders/[orderId]/page.tsx:453-537`, `assignment.ts:82-127`.
**Why slow.** ~10 serial phases; `await` in `for`; each wasted phase = 1×RTT.
**Recommended fix.**
1. Coalesce: `const [detail, creationEvent] = await Promise.all([getOrderDetail(actor, orderId), db.auditEvent.findFirst(...)])`; then `const [assigneeRows, reworkCounts] = await Promise.all([...])`.
2. Batch designers: `await Promise.all(assignable.map(wi => getEligibleDesigners(actor, wi.id)))`, or better — add a `getEligibleDesignersBatch(workItemIds)` service that groups by department with `IN` queries (fewer round-trips than even parallel per-item calls).
3. `departments` and `findPendingChangeRequestIds` are independent of each other → join the same `Promise.all`.
4. Wrap `<SpecHistory>` per row in `<Suspense>` (Fix B).
**Example.**

```ts
const [detail, creationEvent] = await Promise.all([
  getOrderDetail(actor, orderId),
  db.auditEvent.findFirst({ where: { entityId: orderId, action: "order.created" }, orderBy: { createdAt: "asc" } }),
]);
// …
const assignable = detail.workItems.filter(wi => DESIGNER_ASSIGNABLE_STATES.has(wi.state));
const designerPairs = await Promise.all(
  assignable.map(async wi => [wi.id, await getEligibleDesigners(actor, wi.id)] as const),
);
```

**Expected impact.** High for this route. **Risk.** Low — pure concurrency reordering; no FSM/auth/audit semantics touched (queries are reads; ordering within the page does not affect correctness).

### Fix E — Batch `phaseDurations` (Rank 6)

**Problem.** §6.5 — 2 queries × 25 rows.
**Recommended fix.** New `phaseDurationsByIds(actor, ids)`:

```ts
// one query each, grouped in JS
const [timings, transitions] = await Promise.all([
  db.phaseTiming.findMany({ where: { workItemId: { in: ids } } }),
  db.workItemTransition.findMany({ where: { workItemId: { in: ids } } }),
]);
```

**Expected impact.** High for `/my-queue` (50 → 2 queries). **Risk.** Low; must reproduce exact duration math — cover with the existing test harness (`tests/`).

### Fix F — Replace bell `router.refresh()` with the wired-but-unused `revalidate` fetch (Rank 7)

**Problem.** §6.6 — 15 s poll re-renders everything.
**Recommended fix.** Route-handler GET `/api/notifications/bell` returning `{count, rows}`; pass it as the `revalidate` prop from `layout.tsx`; in `useNotificationStream`, call `revalidate()` on tick **without** `router.refresh()`; keep `router.refresh()` only for explicit mark-read actions if still needed. Optimize count with `useOptimistic` for instant badge feedback.
**Expected impact.** High (removes a full layout+page re-query every 15 s; stops background pool contention). **Risk.** Low — bell is display data; server remains authority on mark-read (`markReadAction` unchanged).

### Fix G — Board `navigate` → `router.push` (Rank 11)

**Problem.** §6.8.
**Evidence.** `BoardProvider.tsx:29-37` passes no `navigate`.
**Recommended fix.**

```tsx
const router = useRouter();
const [controller] = useState(() => createBoardController(initialSnapshot, {
  /* …existing… */ navigate: (href) => router.push(href),
}));
```

**Expected impact.** Medium (one edge, but converts multi-second reload → ~300 ms). **Risk.** None — soft nav preserves state; verify SCREEN edges still land with `?workItem=`.

### Fix H — Scope notification revalidation (Rank 10)

**Recommended fix.** Replace `revalidatePath("/", "layout")` with `revalidatePath("/notifications")` + a `revalidateTag("notifications-bell")` on the bell fetch (Fix F). **Risk:** low — layout bell data arrives via `revalidate` fetch after Fix F; audit before removing if any other surface reads notifications server-side.

### Fix I — Migration hygiene + indexes (Ranks 8, 13)

1. Reconcile `prisma/migrations/` with `prisma/schema/migrations/` (specs/091 already intends a `1_baseline` fold). Verify live state per §9 first.
2. Apply R1–R3 only after the §9 verification query; drop `FileObject_sha256_idx`.
**Risk:** schema migration on a mission-critical DB — run `migrate diff` against production, stage as a normal migration, never `db push` over prod.

### Fix J — Small mechanical set (Ranks 15–19)

- `transitions: { where: { to: "WAITING_REVIEW" }, orderBy: { at: "desc" }, take: 1 }` in `review/queue.ts:47`; add a `take` ceiling to the queue query.
- `orders: { select: { id, number, createdAt, priority }, take: 20 }` in `customers/service.ts:36`.
- Swap raw `<a>` → `Link` in `daily-cash` and `admin/audit`.
- Remove dead `/orders` and `/settings` rail links (or add routes).
- Batch `getCurrentPrice` loops with one `priceHistory.findMany({ where: { workItemId: { in: ids } } })` grouped to latest-per-item — **but validate pricing semantics (effective-dating) with the pricing tests (`pnpm test:pricing`) before changing; this code is inside money paths.**

---

## 18. Prioritized Implementation Plan

### Fix First (do these before anything else)

1. **Fix A — neutralize the navigation overlay** (`isNavigating` path in `AppBootLoader`/`LoadingExperience`). One component; removes ~1.3 s from *every* click; zero server risk. Get product sign-off on the UX intent.
2. **Fix B — add `(shell)/loading.tsx` + Suspense around async children.** One file + wraps; converts frozen waits into instant shell paint on all 25+ routes.
3. **Fix C — shell layout: delete the duplicate `db.user.findUnique`, coalesce phases, unify session cache.** Removes 1–2 sequential RTTs from *every* authenticated navigation against the remote DB.

### Fix Second (server-side latency)

4. **Fix D** — `/orders/[orderId]` parallelize + batch designers (worst route).
5. **Fix E** — batch `phaseDurations` on `/my-queue` (50 → 2 queries).
6. **Fix F** — bell poll stops calling `router.refresh()` (kills 15 s background re-renders).
7. **Fix I** — verify live indexes (`§9 SQL`), reconcile migration dirs, apply R1–R3.
8. **Fix H** — scope `revalidatePath("/", "layout")`.

### Optional Optimizations

9. **Fix G** — board SCREEN soft-nav (small, targeted).
10. **Fix J** — review-queue `take:1` on transitions, customers `orders` select, raw `<a>` swaps, dead links.
11. `getCurrentPrice` batching (only with pricing-test sign-off — money path).
12. `experimental.staleTimes.dynamic` (e.g. 30 s) — only after H; measure prefetch hit rate first.
13. Login callback default → `/board` (skip `/` redirect hop).

---

## 19. Files Likely Requiring Changes

```
src/components/loading/app-boot-loader.tsx
src/components/loading/loading-experience.tsx
src/components/loading/loading-config.ts
src/app/(shell)/loading.tsx                          (new)
src/app/(shell)/layout.tsx
src/server/auth/getActor.ts
src/server/better-auth/server.ts
src/app/(shell)/orders/[orderId]/page.tsx
src/server/designers/assignment.ts
src/app/(shell)/my-queue/page.tsx
src/server/designers/timer.ts
src/components/notifications/NotificationBell.tsx
src/components/notifications/use-notification-stream.ts
src/app/(shell)/notifications/actions.ts
src/app/api/notifications/bell/route.ts              (new, for Fix F)
src/components/board/BoardProvider.tsx
src/server/review/queue.ts
src/server/customers/service.ts
src/server/finance/summaries.ts
src/server/finance/profitability.ts
src/server/finance/payments.ts
src/app/(shell)/finance/daily-cash/page.tsx
src/app/(shell)/admin/audit/page.tsx
src/components/shell/IconRail.tsx
prisma/migrations/ + prisma/schema/migrations/       (reconcile)
next.config.js                                       (only if staleTimes pursued)
```

---

## 20. Risks and Correctness Considerations

- **Auth/RBAC:** Fix C only moves *display fields* (`name`, `username`) the session query already returns into the `Actor`. Do **not** cache the actor persistently, do not move authorization client-side, do not skip `getActorForSession`'s `isActive` check (`getActor.ts:59-61`).
- **Workflow FSM / audit:** no fix here touches transitions, audit recording, or state derivation. Finance `getCurrentPrice` batching (§18.11) is the single change adjacent to money math — gate it behind `pnpm test:pricing`.
- **Persistent caching:** this report recommends **request-level memoization only** for auth/data. `staleTimes`/`revalidateTag` appear only where the data is display-only (bell count) after the targeted-fetch fix; queue state, prices, and RBAC must always read fresh per request.
- **Indexes:** write amplification on `WorkItem.state` (R1) and `audit_event` (R3) — acceptable but should ship with the migration reconciliation, not before the live-index verification (§9), or you may re-create an index that already exists under the other tree.
- **Loader removal** is a deliberate UX feature being removed — flag to whoever designed it; the constants' comments show intent ("eliminate visual flicker"). The recommended fix preserves boot behavior and drops only the navigation path.
- **Router refresh removal (Fix F)** — server remains authority for read state; mark-read actions still run server-side. Verify the bell's error/retry path still triggers when the GET fails.

---

## 21. Measurements Still Needed

Static analysis cannot produce these; run with `PRISMA_LOG_QUERIES=1` in dev and browser DevTools in production (`pnpm build && pnpm start`):

1. **Live index verification** — the §9 SQL against production (blocked: `P1001` unreachable from this machine). Resolves the migration-split premise definitively.
2. **Per-navigation RSC timing** — DevTools Network: duration of the RSC fetch per route (`?_rsc=` requests), split TTFB vs transfer. Compare `/board`, `/my-queue`, `/orders/[orderId]`, `/production`.
3. **Query durations** — `PRISMA_LOG_QUERIES=1` (or Prisma `log: ["query"]` event timing) during one navigation each: confirm layout = 5 queries, my-queue ≈ 55, order detail ≈ 95+, and identify the single slowest statement (candidates: review backlog scan, `auditEvent` probe without R3, notification sort without R2).
4. **DB RTT** — `ping aws-1-eu-west-1.pooler.supabase.com` and `EXPLAIN ANALYZE` a representative queue query from the deployment network. Multiplies every serial phase in §15.
5. **Overlay time empirically** — Performance panel, click a link, measure pointerdown → loader unmount; expect ≥1300 ms even when the RSC finished in ≤300 ms.
6. **Poll interference** — record two navigations 15 s apart; the one colliding with a bell refresh should show TTFB inflation.
7. **Background loop load** — outbox/delay scheduler tick frequency and rows scanned per tick (`src/server/notifications/processor.ts`, `scheduler.ts`) vs pooler capacity.

---

## 22. Final Diagnosis

- **Is database latency the primary cause?** **No — not as "slow queries."** Individually, the queries are ordinary (`count` on an indexed predicate, keyed `findMany`s), and Prisma/query-logging config is clean. But **the *way* queries are issued** — serialized phases, N+1 loops, duplicates — over a **remote Supabase pooler rather than the assumed LAN** makes *round-trip count* the dominant server-side cost. DB contributes through **query shape and topology**, not through any single slow statement (pending §21.3 confirmation).

- **Does the frontend/navigation architecture contribute?** **Yes — most of all.** The `AppBootLoader` alone holds an opaque full-screen overlay for ~1.3–1.6 s per navigation regardless of server speed, and the total absence of `loading.tsx`/`Suspense` means zero streaming anywhere. Together these dominate the *perceived* symptom the user reported. They are client/build properties that survive into production.

- **Do repeated queries contribute?** **Yes.** The layout's duplicate `db.user.findUnique` fires on every authenticated navigation; the 15 s poll re-runs the entire layout+page tree via `router.refresh()`; `revalidatePath("/", "layout")` prevents any cache reuse. Ranks 3, 7, 10.

- **Does auth contribute?** **Partially — ~2 necessary sequential round-trips + 1 avoidable duplicate per navigation.** RBAC itself is free (in-memory `Set`), `getActor` is correctly request-cached, and shell chrome doesn't re-resolve auth. Auth is a contributor multiplied by remote RTT, not the headline.

- **Do missing indexes contribute?** **Probably, but unproven (LIKELY).** Three navigation-path indexes are justified by code (R1–R3), and — more importantly — a **migration-directory split means production may be missing indexes that exist only in the non-active tree**. This must be verified live before indexing work begins.

- **The largest bottleneck, stated plainly:** **perceived latency is owned by the client-side loading overlay plus the lack of streaming; actual latency is owned by sequential round-trips (layout waterfall + worst-route waterfalls + N+1s) multiplied by a remote database.** The first fix is deleting the `isNavigating` loader path; the second is a `loading.tsx`; the third is collapsing the layout waterfall and removing the duplicate user read. Only after those will per-query tuning (indexes, batching) be visible in the numbers — and a DB-first investigation would have optimized queries while users still waited on a 1.3-second spinner the server never knew about.
