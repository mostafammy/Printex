# Research: Notifications & Delay Detection

Phase 0 for `/speckit-plan`. Every unknown in plan.md's Technical Context is resolved here.

## Decision: The `Notification` row is the idempotency boundary — a unique pair of (source event, recipient)

**Decision**: `Notification` carries `sourceEventId` (FK to the outbox row) and `userId`, with a database unique constraint on that pair. A notification is created per (event, resolved user) inside the same transaction that marks the outbox row processed. Reprocessing an event that is already processed is prevented by the outbox row's own processed marker; the unique pair is the backstop that makes a duplicate structurally impossible even when two processes race, a batch is retried, or a process dies between the insert and the commit.

**Rationale**: The acceptance criterion "processing the same outbox event twice creates one notification" is the one thing 053 must never get wrong, and it is exactly the class of problem 052 solved with `FinanceVoid`'s `@@unique(entityType, entityId)` — let the schema refuse the bad write rather than asking application code to be careful. An application-level "have I seen this event?" check is a read-then-write race under concurrency: two processors both read "unprocessed", both resolve, both insert. The unique pair makes the second insert fail at the database regardless of timing. Pairing it with the processed marker on the outbox row (which makes the common case a no-op rather than a constraint violation) keeps the constraint as a backstop rather than the normal path.

**Alternatives considered**: A `deliveredEventIds` cache table — rejected (a second source of truth for "what was delivered", and it can drift from the notifications themselves); an application-level `findFirst` guard before insert — rejected (read-then-write race under two concurrent processors); relying on the outbox row's processed marker alone — rejected (protects only the common sequential case, not a concurrent double-claim or a partial-batch retry).

## Decision: Recipients are resolved at processing time into a frozen snapshot, not resolved again at read time

**Decision**: Recipient resolution happens once, in the processor, and the resulting notification rows are what the UI reads. If a user gains a role after an event was recorded but before it is processed, they receive that notification; if they lose the role, they still have it. The `Notification` row stores the display facts (title, body, link target, entity reference) captured at creation, so a later change to the referenced Work Item or to the catalog's template never rewrites what the notification says.

**Rationale**: 002's contract explicitly makes resolution "053's job at delivery time", and a notification is a statement about a moment — "your design was rejected at 14:05 because the dimension was wrong" — not a live view that silently re-derives itself as the Work Item moves on. It also keeps the read path cheap: the bell's unread count is a `count(*) where userId = ? and readAt is null` over indexed rows, not a join back through the outbox to re-resolve roles on every page load. Snapshotting also makes the notification's deep link stable, so a link delivered before a Work Item moved still opens that Work Item rather than whatever it became.

**Alternatives considered**: Storing only the event reference and re-deriving recipients and titles on every read — rejected (the title would change retroactively, the read query would join the outbox on every bell render, and a role change would silently rewrite history); storing the recipient spec on the notification and re-resolving on read — rejected (same retroactive-mutation problem, plus it makes "who was told" depend on data that can change after the fact).

## Decision: Recipient resolution takes four addressing modes, adding permissions as an additive fourth

**Decision**: The resolver accepts `userIds`, `roles`, `departmentIds`, and — newly — `permissions`, each optional, combined as a union deduplicated by user. Adding `permissions` extends 002's `NotifyEvent` shape with a new optional field; it changes no existing mode's meaning and requires no existing emitter to change.

**Rationale**: Three shipped specs already express recipients in a way 002's shape cannot carry. 016 resolves recipients as `usersWithPermission("design.review")` and `"change.approve"`, and 091's `ops.*` alerts are specified as targeting `admin.config` holders. Either 053 rejects those events (losing a spec's notifications entirely), or 053 resolves permissions itself. Rejecting them is worse than extending the shape, because 016's change-control notifications are a large and important set — a customer modifying a specification is precisely the event the shop most needs to hear about. The extension is backward-compatible by construction: an absent `permissions` array means no permission-addressed recipients, which is exactly today's behavior.

**Alternatives considered**: Rejecting events whose recipients cannot be expressed, and asking 016/091 to change to role addressing — rejected (role addressing is strictly coarser; a shop may have several Head Designers but a specific permission held by one person, and 091 explicitly reserves the right to move to `admin.config` addressing); 053 inventing its own side-channel recipient table — rejected (a second outbox, forbidden by 002's "Do not build a second outbox table for a new feature's events"); making 053 infer permission recipients from role names — rejected (constitution VI: roles are permission scopes, never business-logic branches).

## Decision: The catalog recognizes both `workitem.*` and `work_item.*` spellings rather than forcing a rename

**Decision**: The catalog keys entries by a canonical type, and each entry may declare aliases. Both `workitem.rejected` (012/013/014) and `work_item.*` (002/015/016/091) resolve to catalog entries. `work_item.*` is designated canonical for all new events. No existing feature's emitted string is changed by this feature.

**Rationale**: Both spellings are live in shipped code — 012/013/014 already call `notify()` with `workitem.rejected` and `workitem.assigned`, and that code is merged. Renaming them would mean editing three shipped features' contracts and their call sites, which is outside this feature's scope and would put 053 in the position of breaking a track-A feature's frozen contract. An alias table costs one column and zero risk. The cost of the alternative is not just churn: if 053 silently failed to map one spelling, designers would stop receiving rejections — the single most important notification in the product (PRD §14, acceptance criterion 8).

**Alternatives considered**: Rename `workitem.*` → `work_item.*` in 012/013/014 as part of 053 — rejected (out of scope, touches three other features' contracts, and risks a missed call site silently dropping notifications); only support the newer spelling — rejected (drops rejection and assignment notifications for the three features that emit them today); a DB-level rename with a compatibility view — rejected (heavier than an alias map for a problem an alias map fully solves).

## Decision: `work_item.state_changed` is a trigger, never a delivered notification

**Decision**: The catalog registers `work_item.state_changed` as a **trigger** type: it produces no notification itself, and instead the catalog derives the specific events that are useful from its `from`/`to` pair (a move into `WAITING_REVIEW` yields "new design awaiting review"; a move into `READY_FOR_PRODUCTION` yields "new production job"; a move into `READY_FOR_COLLECTION` yields "order ready"). Derived events carry their own recipient specification and their own title.

**Rationale**: 002 emits `work_item.state_changed` on *every* transition with an empty recipient list — it is the highest-volume event in the system and carries no recipients by design, which is precisely why 002's contract hands resolution to 053. Delivering it verbatim would mean every Work Item transition, including internal ones like a timer-adjacent state nudge, would need a recipient set, and any recipient set broad enough to be useful (reception, owner) would be buried in noise. Deriving the one useful event from the transition is what makes the catalog a business artifact rather than a mirror of the database. It also directly serves several PRD §38 entries that no other spec emits — "new design awaiting review", "new production job" — which today have no emitter at all.

**Alternatives considered**: Deliver `work_item.state_changed` to a broad audience — rejected (alert fatigue destroys the signal; the shop would mute or ignore the whole center within a week); require every emitting feature to also emit its specific event — rejected (leaves PRD §38's review and production entries unemitted, and couples 053's catalog to features that may never ship); deliver it only to the assignee — rejected (the assignee does not need to be told about their own work moving; that is the queue's job, 012's).

## Decision: Both idempotency layers are required — a lease prevents duplicate runs, a unique constraint prevents duplicate notifications

**Decision**: Two independent mechanisms. (1) A persisted scheduler lease (single row, owner + expiry) guarantees at most one scheduler instance runs at a time across all processes; a second instance skips the tick. (2) The `Notification` unique pair on (source event, recipient) guarantees at most one notification per recipient per event regardless of how many processors run. The outbox processor uses a claim query that atomically marks rows in-progress, so a batch is not processed twice concurrently.

**Rationale**: These solve genuinely different problems and neither alone suffices. The lease stops the *normal* case — two instances during a rolling deploy, or a restart racing the old process. The unique constraint stops the *abnormal* case — a lease that expired mid-run (long GC pause, a stalled query, a suspended laptop), a manual re-run of the processor, or a bug that runs the batch twice. A design that relies on the lease alone fails silently under exactly the conditions a small shop hits most (a server that gets rebooted, a laptop that sleeps, a process killed mid-tick). A design that relies on the constraint alone produces a stream of constraint violations during a rolling deploy, each of which is noise the operator must learn to ignore.

**Alternatives considered**: A PostgreSQL advisory lock held for the duration of each run — rejected (a lock released by a crashed process is fine, but a lock held across a long transaction blocks a second instance's connection rather than making it skip cleanly, and it is invisible to an Admin inspecting state); a job queue table with a `FOR UPDATE SKIP LOCKED` claim — rejected (a reasonable pattern, but it introduces a queue abstraction the shop does not otherwise have, for a single-consumer, single-machine workload); timestamp-based "last run" checking — rejected (two instances reading the same timestamp both conclude they should run).

## Decision: `DelayBreach` is a persisted fact, not a status column on the Work Item

**Decision**: A `DelayBreach` row is created when a Work Item is first found to exceed a phase's threshold, keyed by (workItemId, phase, breachSequence). It is what makes "exactly one alert per breach" enforceable: the alert is created in the same transaction as the breach row, so a second scheduler tick that finds the same Work Item still breaching attempts an insert that already exists. The Work Item itself gains no delay column — delay is derived at query time.

**Rationale**: "Once per breach, not once per tick" is a data-integrity requirement, not a timing requirement. A scheduler that only alerts on a state *transition* needs to store somewhere that the breach was already announced, and a boolean on the Work Item is the obvious place — but that turns a derived fact into stored state that can drift (the Work Item moves on, the flag is not cleared because a code path forgot; the delay queries then report a stale answer). A separate breach row is also what makes the escalation case in FR-047 possible later: the second threshold needs to know that the *first* threshold already fired, and a row-per-breach has that history naturally while a boolean does not. A Work Item that leaves a delayed phase and later re-enters and re-breaches simply gets a new breach row with a new sequence, which is exactly the required "new breach, alert again" semantics.

**Alternatives considered**: A `delayedSince` timestamp on WorkItem — rejected (it is a second source of truth for a derived fact and needs careful clearing on every transition path, including the twelve that can move a Work Item out of a phase); a `notifiedAt` timestamp on the PhaseTiming segment — rejected (PhaseTiming segments are closed and re-opened by unrelated timer code, so the lifetime of the two records does not match); an in-memory "already alerted" set — rejected (lost on restart, which is precisely when a duplicate alert is most likely to appear).

## Decision: Workflow-phase waiting age comes from the open `PhaseTiming` queue segment; pricing age comes from 051

**Decision**: For the five phases, waiting age is `now() − startedAt` of the open `QUEUE` segment for the Work Item's current phase (002's `PhaseTiming`), except pricing, which uses 051's `PricingStatus.waitingSince` via the `pendingSince()` function 051 froze for exactly this consumer. No age is computed from a running counter, and no age is stored on the Work Item.

**Rationale**: 002 already opens a `QUEUE` segment on every transition into a new phase, in the same transaction, so the anchor timestamp for "how long has this been waiting" already exists and is already correct across restarts — constitution III's rule that durations come from persisted timestamps, not stopwatches. Reading it means 053 adds no write path to the timer subsystem and cannot desynchronize from it. Pricing is the one phase that is not a workflow state: 051 tracks pricing status independently of workflow state (PRD §55 Rule 9 — "pricing status must be visible independently from production status"), and a Work Item can be in production while its price is still pending. Using the workflow segment for pricing would report "0 minutes waiting" for a job that has been unpriced for a week, which is precisely the failure the shop is trying to eliminate (PRD §27, `Printex.md` Journey 4: "Unpriced Order Pending Quotation" on the Owner's dashboard). 051 froze `pendingSince()` and explicitly deferred the threshold to 053.

**Alternatives considered**: A new `waitingSince` column on WorkItem maintained by 053 — rejected (a second write path into the workflow, which 002's single-mutator rule forbids in spirit and which would need to be updated on every transition); deriving workflow age from `WorkItem.updatedAt` — rejected (`updatedAt` moves for any field change, including a note edit or a file upload, so a Work Item someone is actively annotating would never look late); a scheduled snapshot of ages — rejected (a stored derived value with a refresh window, which is worse than reading the anchor that already exists).

## Decision: The scheduler runs in-process behind a persisted lease, not as a worker container

**Decision**: A single guarded interval inside the Next.js server process runs the delay check every 5 minutes, guarded by a persisted lease row (owner instance id + expiry) so only one instance runs a tick. Startup, and any tick after a gap longer than the interval, evaluates current state rather than skipping the window.

**Rationale**: The deployment topology is one local server on a LAN with the app, database, and storage on the same machine (PRD §52, constitution VII). A separate worker container would add a process the shop has to install, start, keep alive, and restart before the feature works at all — a real operational burden for a shop whose IT is whoever is nearest. A leased in-process interval gives the same exactly-once-per-tick guarantee with no new deployment surface, and 091's compose file already reserves a disabled `worker` profile, so moving to a container later is a deployment change rather than a data migration. Running the check on startup rather than on a fixed cadence alone matters because the shop's most common alert window is the morning: if the server was down overnight, the delay state must be evaluated on the first tick back, or a shop that opens at 09:00 sees nothing about the jobs that went stale overnight.

**Alternatives considered**: A separate worker container — rejected (new deployment surface for a single-machine shop, against constitution VII's spirit; retained as a 091 compose profile for later); a cron job inside the app — rejected (same process, but cron's granularity and its behavior under a multi-instance deploy are both worse than an explicit interval with a lease); checking on page load only — rejected (a shop that is closed all weekend gets no Monday-morning alerts until someone happens to open a page, which defeats the purpose of a morning delay alert); a database-level scheduled job — rejected (Postgres has no durable scheduler, and a cron-driven `pg_cron` would put application logic in the database).

## Decision: The catalog's derived events cover PRD §38's unemitted entries, and their emitters are the owning features

**Decision**: PRD §38 lists events that no spec currently emits — "new design awaiting review", "new production job", "pricing delayed", "production delayed", "repeated rejection", "operational anomaly". 053 defines the catalog entries and derives the first two from `work_item.state_changed`, generates the delay pair from the scheduler, and provides the entry + a small public helper for the last two so that the owning features (013 for repeated rejection, 014 for a major discrepancy) can raise them. 053 does not implement the emitting side of another feature's business rule.

**Rationale**: PRD §38 is a requirement on the notification system, not on any single feature — it says "the system must notify employees about events relevant to them", and the catalog is where that requirement lives. Leaving the entries out would make 053's catalog incomplete against its own cited PRD section; implementing another feature's business rule (how many rejections constitute "repeated") would make 053 the owner of a rule that belongs to 013, and would couple 053's release to 013's. Defining the entry plus the helper is the seam: 053 owns "this event exists, it looks like this, it goes to these recipients", and 013 owns "when a third rejection happens".

**Alternatives considered**: Leave the unemitted entries out of the catalog — rejected (the spec's FR-012 requirement is stated against PRD §38, so omitting them fails its own acceptance criterion); have 053 compute "repeated rejection" by counting returns — rejected (a cross-feature read of another feature's business rule, and it would fire without 013's consent on what counts); wait for every emitting feature to land first — rejected (053 would then deliver nothing at all on day one, and the shop's most valuable alerts — rejections, assignments — are already emitted today).

## Decision: Unmapped event types are processed and reported, never dropped silently

**Decision**: An outbox event whose type has no catalog entry is still marked processed and recorded, produces no user-visible notification, and increments a counter that an Admin can see on the thresholds screen. The processor logs the type at a level that surfaces it.

**Rationale**: The outbox is written by features 053 does not control, and its contract explicitly says `type` is a free-form namespaced string that 002 does not enumerate. Two failure modes are both unacceptable: throwing on an unknown type would make 053's failure break an unrelated feature's transaction's downstream, and silently ignoring it would make a notification gap invisible — a designer would never learn that the shop stopped being told about something. Treating an unknown type as a processed no-op with a visible counter gives the "never break the emitter" property and the "never hide the gap" property at once, which is the same reasoning that governs 091's `messageKey` convention.

**Alternatives considered**: Throw on unknown types — rejected (a catalog gap in 053 would become a runtime failure in 011–016's write paths); silently ignore — rejected (the gap is invisible and permanent); auto-generate a generic notification from the raw payload — rejected (a notification nobody can act on, delivered to a guessed recipient, is worse than none).

## Decision: The outbox's own reserved columns are the processing markers — no parallel pair

**Decision**: 053 writes `deliveredAt` and `deliveryStatus` — the two columns 002 already shipped and
explicitly reserved for it — and adds only `attemptCount`, `lastAttemptAt`, `lastError`. `deliveryStatus` is
retyped from `String?` to the `DeliveryStatus` enum. The migration backfills `NULL → PENDING` before adding
the claim index.

**Rationale**: 002's shipped schema (`prisma/schema/core.prisma`) carries `deliveredAt DateTime?` and
`deliveryStatus String?` with the comments `/// Left null; written by 053`, and 002's data-model and contract
both reserve them. The first draft of 053's artifacts instead specified `processedAt`/`processingStatus`, which
would have left 002's two columns permanently dead and given one row two answers to "was this event
processed?" — the exact second-source-of-truth problem constitution III exists to prevent. A retype is a safe
`ALTER` because 002 never wrote the column, so every existing row is NULL. The backfill is not optional: 012,
013, 014, 015, and 016 are live and have already recorded events into this table, and without it the claim
predicate (`deliveredAt IS NULL AND deliveryStatus = 'PENDING'`) would skip every one of them — the feature
would ship "working" while delivering nothing for the events that motivated it.

**Alternatives considered**: Keep the parallel pair and ignore 002's — rejected (leaves dead columns and two
answers per row); drop 002's columns in the migration — rejected (002's contract reserves them, and dropping
them means editing a shipped, frozen schema for no gain); retype `deliveryStatus` without a backfill — rejected
(above).

## Decision: The per-event override unions with the catalog default; removal is deliberately inexpressible

**Decision**: `NotificationTypeOverride` stores four recipient arrays per catalog type. The resolver unions
them with the catalog's defaults. There is no "replace" or "exclude" mode, and an empty array is a no-op —
clearing an override is a `DELETE` of the configuration row.

**Rationale**: FR-017 requires the redirect to be configuration rather than a code change, and the audit
contract already reserved `notification.recipient_override_updated` for it. Union semantics were chosen over
replacement for one specific reason: replacement makes a stray Admin edit able to silently mute a role the
business depends on — an override that empties the designer recipients would stop PRD §14's rejection
notifications, and nothing would report it as an error. Under union, the worst case of a bad override is
*more* people hearing about something, which is recoverable. Removal is left inexpressible for the same
reason: a shop that wants to stop one role hearing about one event can narrow the threshold row or archive
the type, but the catalog's floor is not editable away by accident. It also sidesteps the empty-array
ambiguity — under union an empty array and no row are indistinguishable, so the schema and UI both treat
"no override" as row-absent.

**Alternatives considered**: Replace semantics — rejected (a bad edit can silently mute a required
notification); a separate `excludedRoles` array to allow removal — rejected (it reintroduces exactly the
removal power that caused the concern, and the audit surface for "who un-notified themselves" is worse than
the failure it prevents); storing overrides in the catalog file and redeploying — rejected (defeats
constitution VI's purpose, which is changing policy without a code change); overloading the existing
`DelayThreshold` table with a `type` column — rejected (that table is keyed by `DelayPhase` for a different
feature's concern, and mixing two recipient models in one row makes both harder to reason about).

## Dependency readiness (facts, not decisions)

| Dependency | State at planning | 053 impact |
|---|---|---|
| 001 auth/audit | Implemented (`getActor`, `authorize`, `audit.record` in `src/server/auth`) | Full surface available; **no new permission key needed** — see note below |
| 002 `notify()` + outbox | Implemented (`src/server/core/notifications/notify.ts`); `NotificationEvent` has no processed marker | 053's migration adds the processed/status columns and the `permissions` recipient field |
| 002 `PhaseTiming` | Implemented; queue segments auto-open on transition | Read-only anchor for four of five phase ages |
| 011 reception queue | Implemented; `listReceptionQueue(actor)` called with no `opts` | Binds `opts.getDelayedWorkItemIds`; works unchanged without it |
| 012 assignment event | Implemented (`workitem.assigned`) | Catalog alias entry |
| 013 rejection event | Implemented (`workitem.rejected`) | Catalog alias entry; PRD §14's 2-second path |
| 014 send-back event | Implemented (`workitem.rejected`, `PRODUCTION_ISSUE`) | Catalog alias; revised-production-file entry defined for 014 |
| 015 collection events | Spec only — no `src/server/collection` | Catalog entries; no compile-time import |
| 016 change events | Spec only | Catalog entries; `usersWithPermission` helper does not exist yet — 053 resolves permissions itself |
| 051 `pendingSince` | Implemented (`PricingStatus.waitingSince`) | Pricing delay anchor |
| 052 finance | Implemented; defers 053/054 notification to "later" | 053 adds no finance events in V1 |
| 090 dashboard | Not started | Consumes `getDelayedWorkItems()` |
| 091 ops alerts | Spec only; reserves a disabled `worker` compose profile | Catalog entries; in-app only; no WhatsApp |

### No new permission key is required

Reading and marking one's own notifications needs no permission — it is scoped by user identity, exactly as reading one's own queue does today. Admin configuration of thresholds reuses the existing `admin.config` key. Viewing the outbox and scheduler run history reuses the existing `audit.view` key. 053 therefore introduces **zero** additions to 001's frozen 22-key vocabulary, which keeps 053 from needing a constitution or 001 amendment for its own surface.

### The one change to a frozen 002 contract

Adding `permissions` to `NotifyEvent` extends a contract 002 states was frozen with Fady (002 contracts/notifications.md). It is additive and backward-compatible, and 053's own operations are unaffected without it — but it must be raised with Fady rather than absorbed silently. Flagged in spec.md Assumptions and Notes for Planning.
