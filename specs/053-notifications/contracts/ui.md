# Contract: Notification Center UI

Owner: 053. All surfaces are Arabic-first and fully RTL, using only logical (start/end) spacing — no
`ml-*`/`mr-*`/`left-*`/`right-*` anywhere, verified by the same lint check that guards the rest of the app
(002 SC-007 precedent). Every screen answers "what do I need to do next?" (constitution IX, PRD §60).

## `<NotificationBell>` — the shell affordance

Placement: the app shell's header area, present on **every** authenticated page for every role
(FR-020). The existing shell (`src/app/(shell)/layout.tsx`) has a sidebar and a `<main>`; 053 adds a header
row to that layout, not a floating overlay — a fixed overlay would collide with the sidebar's own
positioning and the logical-property lint.

```tsx
<NotificationBell actor={actor} />
```

| Element | Content | Behavior |
|---|---|---|
| Bell button | lucide `Bell` icon + count badge | Opens `<NotificationDropdown>`; badge shows the unread count |
| Count badge | exact count, Arabic numerals, `99+` when ≥ 100 | Display bound only; the API and page count stay exact (spec Edge Cases) |
| Transport hint | `transport === "polling"` → a small muted dot + tooltip | Display-only; never a warning (FR-030) |

Server Component. Reads `notificationCenter.unreadCount(actor)` — a single indexed count, no join
(research.md §2). Re-reads on `router.refresh()` and on the stream's invalidation signal. Zero permission
keys.

Accessibility: the button carries `aria-label` with the count ("الإشعارات، ٣ غير مقروءة"), the badge is
`aria-hidden` (the label carries the number so it is not announced twice), and the dropdown is a
`role="menu"` with arrow-key navigation and Escape to close.

## `<NotificationDropdown>` — the at-a-glance list

Opens on click, closes on Escape / outside click / route change.

```tsx
<NotificationDropdown actor={actor} initialRows={NotificationView[]} />
```

| Element | Content | Behavior |
|---|---|---|
| Header | `الإشعارات` + unread count | — |
| "Mark all read" | `تعليم الكل كمقروء` | Calls `markAllRead`; disabled when unread is 0 |
| "View all" link | `عرض الكل` | Navigates to `/notifications` |
| Row | severity dot, captured title, relative time, entity label | Unread rows carry a distinct background + a start-edge marker |
| Empty state | `لا توجد إشعارات` | Arabic, centered, never blank (FR-026) |
| Error state | `تعذّر تحميل الإشعارات` + retry | Only on a genuine read failure |

Server-fetched rows (first page, 10) passed in from the layout's server render; the dropdown itself is a
small Client Component for open/close and keyboard handling. Marking read is a Server Action, so no client
state can drift from the server's read state (constitution V).

Clicking a row: call `markRead` **then** navigate to `linkHref` in one transition, so the count is already
correct when the destination page renders. A row whose `linkHref` is `null` (out of scope, or the target was
hard-removed) is non-navigable and shows a muted cursor — it never triggers a broken navigation or an
error toast (FR-025, spec Edge Cases).

## `/notifications` — the full page

```tsx
// src/app/(shell)/notifications/page.tsx
```

| Section | Content | Behavior |
|---|---|---|
| Title | `الإشعارات` | — |
| Filters | All / Unread / Read, plus a type dropdown from the catalog | URL search params; server-rendered |
| List | Full-width rows: severity, title, body, entity link, absolute time, read toggle | Paginated, 20/page, newest first (FR-021) |
| Empty | `لا توجد إشعارات` per filter state | Distinguishes "no notifications at all" from "none unread" |
| Pagination | `السابق` / `التالي` | Disabled at the ends |

Marks read on click-through, exactly as the dropdown. The page is the durable view: a user who dismisses a
dropdown without reading still finds the notification here (spec US3).

## `/admin/notifications` — the thresholds screen

Permission: `admin.config` (PRD §48 "Configure notifications"). Reached from the existing
`/admin` section; 053 adds the nav entry in `src/app/(shell)/nav.ts` using the existing `ADMIN: RoleKey`
constant (002's `navItems` pattern).

```tsx
// src/app/(shell)/admin/notifications/page.tsx
```

| Section | Content | Behavior |
|---|---|---|
| Thresholds table | One row per phase (تصميم / مراجعة / تسعير / إنتاج / استلام): enabled toggle, duration input, recipients, escalation input | Duration in hours+minutes; minutes accept `30` for 30 minutes and `4h` for 4 hours |
| Save | `حفظ` with a required reason field | `admin.config`; reason required by 053's policy before `audit.record` (FR-061) |
| Scheduler panel | running state, last run time, evaluated/flagged/alerted counts, next run, lease owner | `schedulerStatus()`; shows `متوقف` when the lease is unheld |
| "Run now" | `تشغيل الفحص الآن` | `admin.config`; triggers one tick (FR-054) |
| "Start" / "Stop" | `تشغيل الفحص التلقائي` / `إيقاف الفحص التلقائي` | `admin.config`; one button whose label reflects current state. Required by FR-054 — the scheduler MUST be startable and stoppable by an Admin **without a redeploy**, so both transitions need a control here. "Stop" is a local pause of this process's interval, not a global kill: it releases the lease, and the state reads `متوقف` |
| Recipient overrides | Per-catalog-type recipients, with the catalog's default shown and a `إلغاء التجاوز` (clear) action | `admin.config`; a **required** reason on save. Required by FR-017; union semantics per `notification-service.md` §`recipientOverride` |
| Unmapped types | Table of `type` + count + last seen, or `لا توجد أنواع غير معرّفة` | Makes the catalog gap visible (FR-019) |

Validation errors render inline against the offending field, in Arabic, with the server's error code mapped
to a message — never a generic "something went wrong" (constitution IX). A rejected save writes nothing and
no audit event (FR-062).

The unmapped-types table is the reason this screen exists for a second audience: an Admin who notices a
missing notification checks here first, and finds out whether the event was never emitted or was emitted
without a catalog entry.

## Delayed-work surfaces

### Reception queue badge (011's reserved slot)

011's `listReceptionQueue(actor, opts?)` accepts
`opts.getDelayedWorkItemIds?: () => Promise<ReadonlySet<string>>` and sets `OrderQueueRow.delayed`. 053
supplies the callback (contract `notification-service.md` § `getDelayedWorkItemIds`); 011's queue page
renders a `متأخر` badge on any row where `delayed` is true, in the existing status-badge cell next to
`غير مكتمل`.

This is a **binding, not a rewrite**: 011's queue works unchanged when the callback is not supplied
(011 FR-008a, FR-058). 053 adds the `opts` argument at the call site in
`src/app/(shell)/reception/page.tsx` and the badge markup — it does not change 011's query, its
authorization, or its ordering.

### Delayed-work list (053's own page)

```tsx
// src/app/(shell)/delayed/page.tsx
```

| Section | Content |
|---|---|
| Title | `الأعمال المتأخرة` |
| Filters | Phase, priority, department, date range |
| Table | Order #, customer, product, phase, **age**, responsible department, priority |
| Row action | `فتح` → `/orders/[orderId]` |
| Empty | `لا توجد أعمال متأخرة` — and a distinct variant explaining that no threshold is enabled for a phase |

The age cell is server-computed and rendered by the one shared formatter the catalog uses, so a delay shows
identically here, in the notification body, and on the dashboard (contract `event-catalog.md`).

A row is a link, not a button that opens a modal — the shop's instinct is to go to the Order, and PRD §60
asks for minimal clicks.

## Server Actions (all under this feature)

| Action | Permission | Notes |
|---|---|---|
| `markReadAction`, `markUnreadAction`, `markAllReadAction` | none (user-scoped) | `revalidatePath("/notifications")` + refresh the shell count |
| `updateThresholdsAction` | `admin.config` | Validates reason non-empty **before** `audit.record` (052's pattern) |
| `triggerSchedulerAction` | `admin.config` | Runs one tick; returns the `SchedulerRun` view |

## Message keys

All Arabic strings live in `src/messages/ar.json` under a new `notifications` namespace plus
`ops.alert.<type>` for 091's `messageKey` convention (091 contracts/backup-health.md §5). Titles and bodies
that come from the **catalog** are stored on the `Notification` row at creation time (FR-018), not looked up
at render time — so a catalog edit never rewrites what an employee was already told.

## Guarantees

- RTL throughout; logical properties only; the existing lint check must pass.
- Arabic throughout, including every empty, error, and validation state.
- No client-side authority: unread counts, read state, recipient sets, and delay state are all server-owned
  (constitution V).
- The bell renders on every authenticated page for every role, with no permission check of its own.
