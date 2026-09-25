# Feature Specification: Notifications & Delay Detection

**Feature Branch**: `helmysaman8/pri-17-spec-plan-053-notifications`

**Created**: 2026-09-25

**Status**: Draft

**Input**: Linear PRI-17 / GitHub #13: everything after `notify()` — the outbox processor that turns recorded events into per-user notifications, role/department/assignee recipient resolution, the PRD §38 event catalog with Arabic titles and deep links, the notification-center UI (bell + unread count + dropdown + page), real-time delivery on the LAN, Admin-configurable per-phase delay thresholds, the scheduler that alerts once per breach, and `getDelayedWorkItems()` for the reception queue and management dashboard. PRD §§11, 14, 27, 37, 38, 48, 49, 50, 55 Rules 3/4/11, 52, 58, 60, 61, 62; constitution II, III, V, VI, VII, IX.

**PRD References**: `Printex Print Shop Management System — Product Requirements Document V1.md`; `Printex.md` FR-04/§6.1; `DEMO ANALYSIS.md`.

**Linear**: [PRI-17](https://linear.app/printex/issue/PRI-17) — blocked by / blocking [PRI-33 Implement: 053-notifications](https://linear.app/printex/issue/PRI-33).

## Clarifications

### Session 2026-09-25

- Q: What default waiting-time threshold should each phase get before a work item is flagged as delayed? → A: Design 4h · Review 1h · Pricing 2h · Production 8h · Collection 24h. All five are Admin-editable in one screen; the defaults are seed values, not hard-coded behavior.
- Q: Should the waiting-time clock keep running overnight, on Fridays, and outside working hours? → A: Wall-clock, always. Age is measured from a real stored timestamp regardless of when it is read; a job sitting over a weekend is genuinely late on Monday. No working-calendar configuration is introduced in V1.
- Q: What should happen when a job is late for far longer than the threshold? → A: One alert per breach, no escalation tier. Each threshold breach notifies its configured recipients exactly once; the alert stays unread until acted on. A second, louder alert for the same breach is not built in V1.
- Q: Where should the threshold-checking scheduler run? → A: Inside the Next.js process, as a single guarded interval deduplicated by a database lease row, so a restart or a second process never double-alerts. No separate worker container.

## User Scenarios & Testing

### User Story 1 - The right employee hears about the right event within seconds (Priority: P1) 🎯 MVP

A designer who has just been assigned a job sees it in their bell — with the order number and a title in Arabic — without refreshing the page. The same happens for a rejection, a customer modification, a returned job, a design waiting for review, a new production job, a revised production file, an urgent job, an order ready for collection, a customer inquiry, and every management-level event in the catalog. Each notification opens the exact Work Item or Order it refers to. Nobody receives a notification for an event that is not theirs, and nobody misses one that is.

**Why this priority**: PRD §38 and acceptance criterion 8 ("rejection automatically notifies the responsible Designer") are the reason the shop stops losing jobs between departments. Delivery mechanics are worthless without the catalog being right, and the catalog is worthless without the processor that resolves it.

**Independent Test**: Drive each catalog event through its emitter and confirm the exact expected recipient set receives exactly one notification with the right Arabic title and a working deep link; confirm a user outside the recipient set receives none. Rejection latency is measured end-to-end from the reject click to the designer seeing the notification.

**Acceptance Scenarios**:

1. **Given** a Work Item with no assignee, **When** reception assigns it to a designer, **Then** that designer receives one notification titled "مهمة جديدة" whose link opens the Work Item, and no other user receives one.
2. **Given** a designer submits a design and a Head Designer rejects it, **Then** the assigned designer receives one notification titled "تم رفض التصميم" carrying the rejection reason, within 2 seconds of the rejection, visible without a page refresh.
3. **Given** a Work Item is in production and a newer design version is approved, **Then** the operator assigned to that Work Item's production department receives one notification titled "تم تحديث ملف الإنتاج" and the Work Item is held until they acknowledge it (014 FR-013).
4. **Given** a customer changes a specification through 016 while a designer is assigned, **Then** that designer receives one notification titled "تعديل من العميل على المواصفات" naming the changed fields.
5. **Given** a Work Item moves to `WAITING_REVIEW`, **Then** every user who can review designs receives one notification titled "تصميم جديد بانتظار المراجعة" — and the raw `work_item.state_changed` event is never delivered to anyone on its own.
6. **Given** the same outbox event is processed twice (a retry, a restart mid-batch, a double scheduler tick), **Then** the second processing creates no new notification and the recipient still has exactly one.
7. **Given** an event whose resolved recipient set is empty, **When** it is processed, **Then** the outbox row is marked processed, no error is raised, and no notification is created.
8. **Given** a user who is not permitted to see a Work Item, **When** a notification about it would otherwise be delivered to them, **Then** they receive no notification and no hint that the Work Item exists.

---

### User Story 2 - A late job is flagged once, to the people who can unblock it (Priority: P1)

Management configures how long each phase may wait. When a Work Item passes its threshold, it is visibly marked delayed, its age and responsible department are shown, and the configured recipients — reception, the responsible production department, owner/admin, accounting — are alerted exactly once for that breach. The alert does not repeat on every scheduler tick, and it does not repeat all night.

**Why this priority**: PRD §50 and `Printex.md` §6.1 ("jobs remaining in any stage past a defined SLA threshold highlight in blinking red on the Owner's screen") are the difference between discovering a lost job on delivery day and discovering it in time. Alert fatigue destroys the signal within a week if this is wrong.

**Independent Test**: Set a threshold to 1 minute, park a Work Item in each phase, let the scheduler run several times, and confirm each breach produces exactly one alert to its configured recipients and one delayed flag; resolve the item and confirm the flag clears and a re-breach later alerts again.

**Acceptance Scenarios**:

1. **Given** the design threshold is 4h and a Work Item has been waiting for design for 4h 1m, **When** the scheduler runs, **Then** the Work Item is flagged delayed, one alert is sent to the configured design-delay recipients, and its age and responsible department are queryable.
2. **Given** the same Work Item is still waiting and the scheduler runs three more times, **Then** no further alert is created for that breach.
3. **Given** the Work Item leaves the design phase, **When** it later breaches the review threshold, **Then** a new and separate alert is created for the review breach.
4. **Given** a Work Item whose pricing has been pending beyond the pricing threshold, **When** the scheduler runs, **Then** the configured pricing-delay roles (PRD §27: owner, reception, accounting, pricing officer) are alerted once, and the alert shows "تسعير معلق — منتظر منذ 2h 14m".
5. **Given** an Admin lowers a threshold so that already-breached Work Items now exceed it, **When** the scheduler next runs, **Then** those Work Items are alerted for the first time — a threshold change does not require a new Work Item.
6. **Given** a Work Item is urgent, **When** it breaches, **Then** the same rules apply as for normal priority; urgency never changes who is alerted or how often.
7. **Given** the server was stopped while a Work Item was over its threshold, **When** it comes back up, **Then** the breach is detected on the first scheduler run after startup and alerted once, not skipped and not repeated.

---

### User Story 3 - Each employee has one place to see everything that needs them (Priority: P1)

Every signed-in employee has a bell in the app shell showing an unread count. Clicking it opens a list of their notifications, newest first, with unread clearly marked. Clicking a notification marks it read and opens the Work Item or Order it refers to. A full page shows the same list with filtering, so nothing is lost off the bottom of a dropdown. Deactivated users keep their history but stop receiving new notifications.

**Why this priority**: The catalog's value is only realized when an employee can actually find the thing that needs them. A bell without a count is a decoration; a count without a page is a ceiling.

**Independent Test**: Generate notifications for one user, load any page, confirm the count matches the unread total, open the dropdown and confirm the list, mark items read one by one and in bulk, confirm the count decrements, navigate from a notification to its Work Item, and confirm the reading survives a reload.

**Acceptance Scenarios**:

1. **Given** a user with 3 unread notifications, **When** they load any authenticated page, **Then** the shell bell shows a count of 3.
2. **Given** the user opens the bell dropdown, **When** it renders, **Then** their most recent notifications are listed newest-first with unread visually distinct from read, each with its Arabic title and a link.
3. **Given** the user clicks a notification, **When** navigation completes, **Then** the Work Item or Order screen is open and that notification is marked read.
4. **Given** the user marks all notifications read, **When** the count is re-read, **Then** it is 0, and a previously read notification stays read.
5. **Given** a user marks a notification unread again, **When** the count is re-read, **Then** it increments by one and the notification reappears in the unread filter.
6. **Given** a user with no notifications at all, **When** they open the bell or the page, **Then** an Arabic empty state is shown, not a blank area or an error.
7. **Given** a user is deactivated by an Admin, **When** a new event would have targeted them, **Then** no notification is created for them and their existing history remains readable to an auditor.

---

### User Story 4 - New notifications arrive without the employee asking (Priority: P2)

An employee with a job open sees a new notification appear in their bell within a couple of seconds, with the count updating, without pressing refresh. If the live connection cannot be established — an older browser, a proxy that buffers, a machine waking from sleep — the same notifications still arrive through periodic checking, just less instantly. Nothing about this depends on the internet being reachable.

**Why this priority**: The 2-second rejection acceptance criterion and "visible without page refresh" depend on it. It is separable from the catalog because the catalog is correct the moment the processor runs; liveness is what makes it feel immediate.

**Independent Test**: Hold a session open, trigger a rejection from another session, and measure time-to-appearance; then break the live connection deliberately and confirm notifications still arrive by the fallback path, with no internet access at all.

**Acceptance Scenarios**:

1. **Given** a user with the app open and the live connection established, **When** a notification is created for them, **Then** it appears in their bell without a page reload, within 2 seconds.
2. **Given** the live connection is unavailable, **When** notifications are created for the user, **Then** they still appear through the fallback path, and the page indicates it is using the fallback.
3. **Given** the server has no route to the public internet, **When** all notification functionality is exercised end to end, **Then** every scenario above still works.
4. **Given** a user has 50 notifications open in 50 tabs, **When** one new notification arrives, **Then** the live connection cost stays bounded and no tab is starved.
5. **Given** a user is signed out, **When** their live connection is open, **Then** it is closed server-side and no further notifications are streamed to it.

---

### User Story 5 - The person responsible for configuring alerts can set them (Priority: P2)

An Admin opens a thresholds screen and sets, for each of the five phases, how long work may wait, which roles are told, and whether that phase is checked at all. Changing a value is audited with who and when. Turning a phase off stops its alerts without affecting the other phases, and never changes the underlying timestamps or history.

**Why this priority**: Constitution VI makes thresholds and notification recipients configurable data, and PRD §48 assigns "Configure notifications" to Admin/Owner. It is a screen over data the engine already reads, so it lands after the engine.

**Independent Test**: Change each of the five thresholds and each recipient list through the screen, confirm the scheduler's next run uses the new values, confirm every change writes an audit event with actor and timestamp, and confirm a disabled phase produces no alerts while the others continue.

**Acceptance Scenarios**:

1. **Given** an Admin, **When** they set the review threshold to 30 minutes, **Then** the value is stored, audited with actor and timestamp, and used by the next scheduler run.
2. **Given** a phase with an empty recipient list, **When** its threshold is breached, **Then** the Work Item is still flagged delayed and still appears in delayed-work queries, but no alert is sent to anyone.
3. **Given** an Admin disables the pricing phase, **When** pricing stays pending for days, **Then** no pricing alert is created, and the Work Item still shows its own pending-pricing state from 051.
4. **Given** a user without configuration permission, **When** they open or submit the thresholds screen, **Then** the server refuses.
5. **Given** an Admin enters a negative or zero threshold, **When** they submit, **Then** validation fails, nothing is stored, and no audit event is written.
6. **Given** an existing threshold is changed, **When** staff look at the Work Item that was previously delayed under the old value, **Then** its delay flag is recomputed from the new value rather than frozen at the old one.

---

### User Story 6 - Every screen can ask "what is late, and whose fault is it?" (Priority: P2)

The reception queue shows a delayed badge on orders containing late work. The management dashboard lists delayed orders with each Work Item's age and the department responsible for it. The same answers come from one query other features can call, and it honors each caller's access scope so nobody sees a Work Item they are not permitted to see.

**Why this priority**: This is 011 FR-008a's reserved seam and PRD §49's "Delayed Orders" tile. The data is already computed by the engine; the query and its presentation are the deliverable.

**Independent Test**: Call the delayed-work query as Reception, as a production operator, and as Admin with the same filters, and confirm each sees only the Work Items in their scope; render the reception queue with a delayed Work Item and confirm the badge appears; confirm the query returns age and responsible department per item.

**Acceptance Scenarios**:

1. **Given** an order containing one delayed Work Item, **When** reception opens the order queue with the delay signal supplied, **Then** that order is marked delayed, and an order with no delayed Work Item is not.
2. **Given** the reception queue is used before the delay feature supplies its signal, **When** it is called with no delay input, **Then** it works correctly and marks nothing delayed.
3. **Given** a production operator requests delayed work, **When** the query runs, **Then** only Work Items in their own departments are returned.
4. **Given** a delayed Work Item, **When** it is returned by the query, **Then** it carries how long it has been waiting, the phase it is waiting in, and the responsible department.
5. **Given** the query is filtered by phase, priority, or date range, **When** each filter is applied, **Then** only matching Work Items are returned, and filters combine.
6. **Given** a Work Item that was delayed and has since moved on, **When** the query runs, **Then** it is no longer returned as delayed.

---

### User Story 7 - A notification is a pointer, never the record (Priority: P2)

Every event that produces a notification also produces its own permanent audit record naming the actor, the action, the entity, and the time. If a notification is lost, unread forever, or the notification center is wiped, the audit log still shows exactly what happened and who did it, and a notification that was never delivered can be reconstructed from the outbox.

**Why this priority**: This is the rule that keeps the notification center honest. A bell is a convenience layer; the audit log is the system of record (constitution III, PRD §45).

**Independent Test**: Take an event that generated a notification, inspect the audit log for the same action, delete nothing but mark every notification read, and confirm the audit record is unchanged and independently readable. Confirm the outbox row still holds the full recipient specification after processing.

**Acceptance Scenarios**:

1. **Given** any event that produced a notification, **When** the audit log for that entity is inspected, **Then** a record of the underlying action with actor and timestamp exists independently of the notification.
2. **Given** a notification that was never displayed because no one was signed in, **When** the user later signs in, **Then** it is present and readable — no notification is lost because the user was offline.
3. **Given** an Admin views the outbox, **Then** processed rows are visible with their processing time and status, so delivery can be reconstructed and audited.
4. **Given** a notification's content is no longer derivable because the referenced record changed, **Then** the notification still shows the title and facts captured at the time it was created, not a re-derived value.

---

### Edge Cases

- An outbox event names a user, a role, and a department that overlap. The recipient set is the **union**, deduplicated, so a user who is both the assignee and a Head Designer receives exactly one notification.
- An outbox event names a role or department that no active user holds. That branch resolves to nothing; the event still processes successfully and is recorded as processed.
- The same event names a user through two different paths (explicit id and role membership). Dedup is by `(sourceEventId, userId)`, so one notification results regardless of how many paths produced the user.
- A user is deactivated between the event being recorded and being processed. They receive no new notification; the event is still marked processed; no retry loop is created by the un-resolvable recipient.
- A Work Item is deleted, cancelled, or transitions while a notification about it is still unread. The notification keeps its captured title and facts; clicking it shows the Work Item's current state, or an Arabic "this item no longer exists" state if it was hard-removed — never a crash and never a 500.
- The scheduler and the outbox processor run in the same process and the process is killed mid-batch. Unprocessed outbox rows are picked up on the next run; processed rows are never re-processed; partial work inside one event's transaction rolls back entirely.
- Two server processes are briefly running during a deploy. The lease guarantees only one runs the scheduler and only one processes the outbox at a time; the unique constraint guarantees that even if both do, no duplicate notification exists.
- A threshold is set to a very small value (minutes). Many Work Items breach at once. The system remains responsive and the alert volume is bounded by the number of Work Items, not by the number of scheduler ticks.
- A Work Item sits in a terminal state (`DELIVERED`, `COMPLETED`, `CANCELLED`) past a threshold. It is never flagged delayed and never alerted — a completed job is not late.
- A Work Item skips a phase entirely (no design required). Phases it never enters are never checked, and it is never delayed for a phase it skipped.
- A Work Item's pricing is pending while it is still in design. The pricing threshold is evaluated from 051's own pending timestamp, so pricing delay can be detected before the Work Item ever reaches a pricing state — and delivery's pricing gate is unaffected by anything 053 does.
- A notification exists for a Work Item the recipient is no longer permitted to view (e.g. transferred to another department). The notification is retained (history is append-only) but clicking it does not reveal the Work Item.
- An event payload is missing a field the catalog template needs. The notification renders with the fields it has and a safe Arabic fallback for the rest — it is never dropped and never throws.
- The live connection is held open by a machine that has gone to sleep. The server notices the dead connection and cleans it up; the user reconnects and receives everything missed.
- A user's unread count is very large. The bell shows a bounded display value while the number in the page and the count API remain exact.
- The system clock or the database clock differs by a small amount. Ages are computed server-side from stored UTC timestamps, never from a client clock, so no user sees a different age for the same Work Item.

## Requirements *(mandatory)*

### Functional Requirements

#### Event intake and recipient resolution

- **FR-001**: The system MUST process recorded outbox events into per-user notifications by reading `NotificationEvent` rows and resolving each row's recipient specification into a concrete set of active users.
- **FR-002**: Recipient resolution MUST support all four addressing modes an event may use: explicit user IDs, all active users holding a named role, all active users in a named department, and all active users holding a named permission. Modes MAY be combined in one event; the result is their **union**, deduplicated by user.
- **FR-003**: Resolution MUST exclude deactivated users. A deactivated user MUST NOT receive a new notification; their existing notification history remains intact and readable to an auditor.
- **FR-004**: An event whose recipient specification resolves to zero users MUST still be marked processed, MUST NOT raise an error, and MUST NOT be retried forever. This mirrors 002's rule that an empty recipient list never blocks the transaction that created the event.
- **FR-005**: The system MUST write each notification in the same transaction that marks the outbox row processed, so an event is either fully delivered or not delivered at all — never partially.
- **FR-006**: The system MUST set the outbox row's reserved delivery marker and its status — the `deliveredAt` and `deliveryStatus` columns 002 already reserved for it — and MUST make both readable to an Admin for audit and reconstruction. These MUST remain the **only** columns on the outbox row that answer "was this event processed?"; a second parallel marker is forbidden, because one row must have one answer. No feature other than 053 writes them.
- **FR-007**: Processing MUST be idempotent. Processing the same outbox event twice MUST produce exactly one notification per recipient, enforced by the system rather than by convention.
- **FR-008**: The system MUST retry a failed event rather than discard it, recording the failure and the attempt count, and MUST NOT mark a failed event processed. A permanently failing event (e.g. a template referencing a removed role) MUST be surfaced to an Admin rather than retried without limit.
- **FR-009**: The system MUST process events in the order they were recorded and MUST NOT process an event before the transaction that recorded it has committed. An event that is still inside an uncommitted transaction MUST NOT be visible to the processor.
- **FR-010**: The system MUST treat the system as the sole authority on recipient resolution. The browser MUST NOT decide who is notified, and a client-supplied recipient list MUST be ignored.

#### Event catalog

- **FR-011**: The system MUST provide one shared, versioned catalog of event types, so that every feature emits and every screen renders the same name for the same event. Emitters MUST reference the catalog constant rather than a hand-written string literal.
- **FR-012**: The catalog MUST cover every event in PRD §38, defining for each: its stable type, its Arabic title, its Arabic body template, its default recipient specification, its deep link target, and its owning feature. The catalog MUST cover at minimum: new assignment · rejection · customer modification · returned work (designer); new design awaiting review (head designer); new job · revised production file · urgent job (production); order ready · pricing delayed · production delayed · customer inquiry (reception); delayed order · pricing delay · repeated rejection · major discrepancy · operational anomaly (owner/admin).
- **FR-013**: The catalog MUST include every event type already emitted by shipped features, so that a notification is produced for each of them rather than being silently dropped: state changes, designer assignment, rejection and send-back, specification change, customer modification, change requested, revised instruction, change rejected or withdrawn, customer-change return, late cancellation, order ready for collection, major discrepancy, monetary compensation recorded, and the operational alerts reserved by 091.
- **FR-014**: A state change MUST NOT be delivered to anyone as a notification in its own right. It is the trigger from which catalog entries for derived events (a new design awaiting review, a new production job, a design completed, a job ready) are derived, so a single transition produces the one notification that is useful to the one person who needs it — never a generic broadcast.
- **FR-015**: Where two features emit the same event name under different naming conventions, the catalog MUST recognize both spellings so that neither emitter is broken and neither recipient loses a notification. The catalog MUST designate one spelling as canonical for all newly added events and MUST NOT require any existing feature to change the string it already emits.
- **FR-016**: Where an event names permissions rather than roles or departments, the catalog MUST support that addressing mode (see FR-002). Adding this mode MUST NOT change the meaning of the existing three modes and MUST NOT break any emitter that does not use it.
- **FR-017**: The catalog MUST support a per-event override of the default recipient specification, so an Admin can redirect an alert without a code change (constitution VI). A user or role MUST NOT be hard-coded into business logic as the only way to be notified.
- **FR-018**: Each notification MUST capture the facts it needs at creation time — its title, its body, its link target, and the identifiers it references — so that later changes to the referenced record never rewrite what the notification said. A notification is a statement about a moment, not a live view.
- **FR-019**: The catalog MUST be the single place a new event type is added. A type with no catalog entry MUST be processed and recorded but MUST NOT produce a user-visible notification, and MUST be reported to the Admin as an unmapped type so it is visible rather than silently lost.

#### Notification center

- **FR-020**: The system MUST show a notification bell with an exact unread count in the application shell on every authenticated page, for every signed-in user regardless of role.
- **FR-021**: The system MUST provide a notification dropdown listing the user's most recent notifications with unread state visibly distinct, and a full notification page listing the same data with filtering and pagination.
- **FR-022**: Clicking a notification MUST mark it read and navigate to the Work Item or Order it refers to. The link MUST be resolved at processing time and stored on the notification, not computed at click time.
- **FR-023**: The system MUST support marking a notification read, marking it unread, marking all read, and filtering by read/unread and by event type.
- **FR-024**: A notification MUST NOT be hard-deleted by any user or by any cleanup routine. Any removal MUST be modeled as archival with an audit event (constitution III).
- **FR-025**: The system MUST scope every notification read and every navigation target to the caller's access. A user who is not permitted to see the referenced Work Item MUST NOT be able to read the notification's detail through the notification API, even though the notification row itself is retained.
- **FR-026**: The system MUST show an Arabic empty state when a user has no notifications, and MUST NOT show an error or a blank region.
- **FR-027**: Notification history MUST be retained for as long as the operational record is retained, and MUST be included in the backup scope (constitution Backups).

#### Real-time delivery

- **FR-028**: The system MUST push a newly created notification to the recipient's connected clients without a page refresh, within 2 seconds of the notification being created.
- **FR-029**: The system MUST provide a fallback path that delivers the same notifications by periodic re-checking when the live connection is not established, so no notification is ever visible only to a live connection.
- **FR-030**: The fallback MUST be the client's default behavior whenever the live connection is unavailable, and the UI MUST indicate which path is in use.
- **FR-031**: All real-time and fallback delivery MUST operate over the local network only, with no dependency on any internet service, no external push provider, and no outbound connection to a third party (constitution VII, PRD §52).
- **FR-032**: The live connection MUST be authenticated as the signed-in user, MUST be closed when that user's session ends, and MUST NOT stream one user's notifications to another. Each stream MUST be scoped to exactly one user's notifications.
- **FR-033**: The system MUST bound the per-connection resource cost so that many idle or sleeping clients cannot exhaust server resources, and MUST reclaim dead connections.
- **FR-034**: Reconnection MUST NOT lose notifications: any notification created while a client was disconnected MUST be present when it reconnects, because delivery is persisted server-side and the live channel only signals that a refresh is needed.

#### Delay thresholds and detection

- **FR-035**: The system MUST support an Admin-configurable waiting threshold for each of the five phases: design waiting, review waiting, pricing waiting, production waiting, and collection waiting. Each threshold MUST be independently enabled or disabled, and each MUST carry its own recipient specification.
- **FR-036**: The seed defaults MUST be design 4h · review 1h · pricing 2h · production 8h · collection 24h, and MUST be changed only through the configuration screen with an audit event.
- **FR-037**: Waiting age MUST be measured from a stored timestamp and MUST always be wall-clock: nights, Fridays, and time outside working hours count. No working-calendar configuration is introduced in V1.
- **FR-038**: Waiting age MUST be derived from data that already exists and is never stored twice: for workflow phases, the open queue segment recorded for the Work Item's current phase; for pricing, 051's pending-since timestamp, which is tracked independently of workflow state (PRD §27, PRD §55 Rule 9).
- **FR-039**: A Work Item MUST be flagged delayed when its current phase's waiting age exceeds that phase's enabled threshold. Terminal Work Items (`DELIVERED`, `COMPLETED`, `CANCELLED`) MUST NEVER be flagged delayed or alerted.
- **FR-040**: A Work Item MUST NEVER be checked against, or delayed by, a phase it does not enter — a Work Item with no design requirement is never delayed for design waiting.
- **FR-041**: When a threshold is exceeded the system MUST highlight the Work Item, generate a notification to the phase's configured recipients, and expose the Work Item's age and responsible department through the delayed-work query (PRD §50).
- **FR-042**: Each threshold breach MUST produce exactly one alert per configured recipient for that breach, regardless of how many times the check runs afterwards. Repeated checks of an unchanged breach MUST NOT create further alerts.
- **FR-043**: A breach MUST be recorded as an identifiable, persisted fact keyed by the Work Item and the phase and the specific breach, so "once per breach" is enforced by the system and not by the scheduler's timing.
- **FR-044**: When a Work Item leaves a delayed phase, its delay flag MUST clear. If the same Work Item later breaches the same phase again, that is a new breach and MUST alert again.
- **FR-045**: Changing a threshold MUST be reflected on the next check for all currently waiting Work Items, including those that become newly delayed as a result, without requiring the Work Item to change.
- **FR-046**: Urgency MUST NOT change delay detection, alerting, or alert frequency (PRD §6, PRD §55 Rule 12).
- **FR-047**: The system MUST provide an optional second escalation threshold per phase, configurable and disabled by default in V1, so that a much later breach can alert again marked as escalated. It MUST NOT be active unless configured.
- **FR-048**: Delay detection MUST NOT change any workflow state, MUST NOT block any action, and MUST NOT alter pricing status, the delivery gate, or any other business gate. It observes and reports; it never intervenes.

#### Scheduler

- **FR-049**: The system MUST run the delay check on a configurable interval inside the existing application process, with a seed interval of 5 minutes.
- **FR-050**: Exactly one scheduler MUST run at a time across all application processes, enforced by a persisted lease so that a deploy overlap, a restart, or a second process cannot produce duplicate alerts.
- **FR-051**: The scheduler MUST complete a missed run after downtime: on startup, and after any period longer than the interval, it MUST evaluate the current state rather than skipping the window.
- **FR-052**: The scheduler MUST be safe to run concurrently with the outbox processor and with user traffic, and its failure MUST NOT block, slow, or corrupt any user action.
- **FR-053**: Each scheduler run MUST be observable: its start, end, counts of Work Items evaluated, flagged, and alerted, and any error MUST be recorded so an Admin can tell whether alerts are running.
- **FR-054**: The scheduler MUST be startable, stoppable, and inspectable by an Admin without a redeploy, and its running state MUST be visible on the thresholds screen.

#### Delayed-work query

- **FR-055**: The system MUST provide one query returning delayed Work Items with, for each, its age, the phase it is waiting in, and its responsible department, filterable by phase, priority, department, and date range.
- **FR-056**: The query MUST be the single source consumed by both the reception queue and the management dashboard, so the two can never disagree about what is delayed.
- **FR-057**: The query MUST scope results to the caller's access — a production operator sees only their own departments, a designer sees only assigned work — and MUST NOT leak the existence of a Work Item the caller cannot view.
- **FR-058**: The query MUST be available in a form the reception queue can consume as an optional signal, and the reception queue MUST continue to work correctly when that signal is not supplied (011 FR-008a).
- **FR-059**: Delay state MUST be derived at query time from current data, so a Work Item that has moved on is no longer returned as delayed and a threshold change takes effect on the next query without a migration or backfill.

#### Audit and record-keeping

- **FR-060**: Every notification-producing action MUST already have, or MUST write, its own audit event in the same transaction as the action that caused it. A notification MUST never be the only record of an event (PRD §45, constitution III).
- **FR-061**: The system MUST write an audit event when a notification is marked read or unread, and when a threshold or notification-recipient configuration is changed.
- **FR-062**: The system MUST NOT write an audit event for a refused or unauthorized action.
- **FR-063**: The system MUST retain the full recipient specification on the outbox row after processing, so delivery can be reconstructed and audited independently of the notifications created.

#### Scope boundaries

- **FR-064**: This feature MUST NOT send anything to a customer through WhatsApp or any other external channel. It produces internal, in-app notifications only; customer messaging is 054's concern and consumes the same outbox separately.
- **FR-065**: This feature MUST NOT send email, SMS, or mobile push.
- **FR-066**: This feature MUST NOT decide when a domain event happens. Owners of 011–016 and 051 decide that and call `notify()`; 053 delivers.
- **FR-067**: This feature MUST NOT introduce per-user notification preferences, per-user muting, or per-user threshold overrides in V1. A user who does not want a category cannot currently opt out; that is a documented gap, not a design choice (see Assumptions).
- **FR-068**: This feature MUST NOT add, rename, or reinterpret any business gate. It observes state and reports; it never blocks.
- **FR-069**: This feature MUST NOT build the management dashboard itself, the customer tracking portal, the quoting inbox, or any WhatsApp composition; it supplies the delayed-work query that those consume.
- **FR-070**: This feature MUST NOT introduce a working-hours calendar, an escalation ladder beyond the single optional second threshold, or predictive delay detection (PRD §56 AI is Phase 2).

### Key Entities

- **Notification**: One notification delivered to one user about one event. Carries the catalog type, the captured Arabic title and body, the deep-link target, the originating outbox event, the related entity, read/unread state, creation time, and read time. Never hard-deleted.
- **Outbox Event (`NotificationEvent`)**: The recorded "something happened and who should hear about it" row, written by 002's `notify()` in the triggering transaction. 053 reads it, resolves recipients, creates notifications, and is the only writer of its processed marker, delivery status, and delivery time.
- **Notification Type (catalog entry)**: The shared definition of one event type — stable name, aliases, Arabic title and body template, default recipient specification, deep-link target, owning feature, and whether it is delivered directly, derived from a state change, or recorded only.
- **Notification Type Override**: An Admin's redirection of one catalog type's recipients, held as configuration data so an alert can be rerouted without a code change. Adds to the catalog's default recipients rather than replacing them, so a bad edit can never silence a role the business depends on. Removable; never carries history.
- **Delay Threshold**: Admin-configured data for one phase — the waiting duration that constitutes lateness, whether the phase is checked, and the roles/permissions/departments alerted on breach. Configurable data, never code.
- **Delay Breach**: The persisted fact that one Work Item exceeded one phase's threshold at one moment, created once and used to enforce one alert per breach.
- **Delayed Work Item**: A derived view — a Work Item currently waiting past its threshold, carrying its age, its phase, and its responsible department. Computed at query time; never stored as a status.
- **Scheduler Run**: One execution of the delay check, recording when it ran, what it evaluated, what it flagged, what it alerted, and any error.
- **Scheduler Lease**: The single record of which process currently owns the delay check, so two instances of the application on one LAN server never double-alert. Identity and heartbeat only; holds no business data.

`User`, `Role`, `UserRole`, `UserDepartment`, `Department`, `AuditEvent`, `Permission` remain owned by 001; `Order`, `WorkItem`, `WorkItemState`, `PhaseTiming`, `NotificationEvent` and `notify()` by 002/011; `ProductType` by 011; `PricingStatus.waitingSince` and `pendingSince()` by 051; `Return` by 013; `FileAsset` and file revisions by 050/014; collection policy and discrepancy records by 015; specification versions and change requests by 016; operational alert reporting by 091.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A designer sees a rejection notification within 2 seconds of the rejection, without refreshing the page, in 100% of trials across at least 20 consecutive rejections.
- **SC-002**: Processing the same outbox event twice — by retry, by restart, or by two concurrent processes — produces exactly one notification per recipient, in 100% of trials.
- **SC-003**: A threshold breach that remains breached across 10 consecutive scheduler runs produces exactly one alert per configured recipient, in 100% of trials.
- **SC-004**: For every event in the catalog, the resolved recipient set matches the catalog's specification exactly — no under-notification and no over-notification — verified for all catalog entries.
- **SC-005**: A user never receives a notification for a Work Item they are not permitted to view, verified across every role in the 001 matrix.
- **SC-006**: The unread count shown on the bell equals the exact number of unread notifications for that user, in 100% of sampled checks, immediately after any read/unread action.
- **SC-007**: 100% of notification reads, notification state changes, threshold changes, and recipient-configuration changes write an audit event with actor and timestamp, committed atomically with the change.
- **SC-008**: With the internet cable unplugged, 100% of notification scenarios — creation, delivery, bell count, dropdown, page, read/unread, real-time push, fallback, and delay detection — behave identically to the connected case.
- **SC-009**: No notification is lost because a user was offline: after any period with no signed-in session, the user's complete notification history since their last visit is present and correct.
- **SC-010**: A Work Item delayed by every phase — design, review, pricing, production, collection — is correctly identified as delayed in each, with the correct age and responsible department, in 100% of fixture cases.
- **SC-011**: A Work Item that is not delayed, is in a terminal state, or has skipped a phase is never reported as delayed, in 100% of cases.
- **SC-012**: Under normal LAN operating conditions, a new notification appears on a connected client within 2 seconds at p95, the bell and first dropdown page load within 500 ms at p95, and the delayed-work query for a full shop returns its first page within 500 ms at p95.
- **SC-013**: After a server restart, an outbox event that was recorded but not yet processed is delivered exactly once, and a scheduler window missed during downtime is evaluated on the first run after startup.
- **SC-014**: A backlog of 200 delayed Work Items across all 5 phases is handled without a scheduler failure or an unbounded alert burst — the alert count equals the number of breached Work Items, not the number of scheduler ticks.
- **SC-015**: 0% of notifications are addressed to an individual employee by name or ID in the delivery rules; every recipient decision traces to configuration (a `DelayThreshold` row, a `NotificationTypeOverride` row, or the catalog's documented default), and each of the five delay phases' recipient lists is changeable by an Admin through the thresholds screen without a code change (constitution VI).
- **SC-016**: The reception queue shows the delayed badge for exactly the orders that the delayed-work query reports, in 100% of compared cases.

## Assumptions

- **Rejection immediacy**: PRD §14's "the responsible Designer must receive a notification immediately" is read as "within seconds, without a page refresh" — it is a delivery-latency requirement, not a synchronous in-transaction requirement. The outbox row is still written in the triggering transaction (constitution V); the processor delivers immediately after commit. Writing the notification inside the rejection transaction would couple delivery to the business transaction and violate 002's outbox contract.
- **A notification is not the record**: The audit log remains the system of record for every event (PRD §45, constitution III). A notification is a convenience pointer with captured facts; if the notification is lost, the audit log and the outbox row still reconstruct what happened.
- **Wall-clock age**: Thresholds count continuous elapsed time including nights and Fridays (Clarifications 2026-09-25). A job started Thursday evening and still unpriced Monday morning is late, which matches how the shop actually experiences delay. Adding a working calendar later is additive — it changes the age computation, not the data.
- **One alert per breach, no escalation tier**: A second escalation alert is not built in V1 (Clarifications 2026-09-25). The optional second threshold in FR-047 exists in the data model so the escalation decision can be activated by configuration rather than a migration, but ships disabled.
- **Scheduler in-process**: The delay check runs as a guarded interval in the Next.js process, deduplicated by a persisted lease (Clarifications 2026-09-25). This matches the single local-server topology in PRD §52 and constitution VII and adds no container to the shop's deployment. 091's compose file already reserves a disabled `worker` profile, so a separate worker remains possible later without a data migration.
- **Recipient addressing**: 002's `notify()` accepts `userIds`, `roles`, and `departmentIds`. Two shipped specs (016, 015, 091) also express recipients as permissions, which the current shape cannot express. 053 adds permission addressing as an **additive, optional** fourth mode (FR-002/FR-016). This does not change the meaning of the three existing modes and requires no existing emitter to change — but it is a change to 002's published contract surface and is flagged for the plan and for Fady's review.
- **Event-name inconsistency is tolerated, not fixed**: 012/013/014 emit `workitem.*`; 002/015/016/091 emit `work_item.*`. Both spellings are live in shipped code. The catalog recognizes both (FR-015) and designates `work_item.*` as canonical for new events. Renaming the existing emitters is explicitly out of scope here and would touch 012/013/014's contracts.
- **State changes are triggers, not notifications**: `work_item.state_changed` fires on every transition with an empty recipient list. Delivering it would bury every employee in noise, so 053 derives the specific useful events from it (FR-014). This is a deliberate interpretation: the catalog's job is to decide who needs to know, not to mirror the database.
- **014's revised-production-file gate**: PRD §38 requires "revised production file" and 014 FR-013 requires a timer-acknowledgement gate, but 014 specifies no event type, recipients, or payload for it. 053 defines `work_item.production_file_revised` in the catalog with the natural recipients (the Work Item's production department) and payload (the new version), and 014 adopts it. The acknowledgement gate itself stays 014's to implement.
- **Unmapped types**: An event type with no catalog entry is processed and recorded but not displayed (FR-019). This keeps 053 from breaking on a new emitter, while making the gap visible to an Admin instead of silently swallowing the event.
- **Notification preferences are out of scope**: Per-user muting and per-category opt-out are explicitly out of scope (FR-067). This is a known gap: a designer who does not want urgent-job alerts currently cannot opt out. The data model does not preclude adding it.
- **Delivery channels**: Internal in-app only. 091's operational alerts (`ops.*`) are in scope for *internal display only* and MUST NOT be routed to WhatsApp or any internet channel — they must work with the internet down.
- **Deactivated users**: 001 deactivates rather than deletes users. A deactivated user is skipped as a recipient but keeps their history, which keeps notification retention aligned with operational history retention.
- **Not a dashboard**: PRD §49's management dashboard and its "Delayed Orders" tile are 090's to build. 053 supplies `getDelayedWorkItems()` and does not build charts, boards, or a Kanban view.
- **Escalation to a wider group**: Routing the first alert to the responsible department and a second to Owner/Admin is a possible future policy. It is not built in V1; the recipient specification is configuration, so it can be expressed without code when the owner wants it.

## Out of Scope

- WhatsApp or any customer-facing message (054).
- Email, SMS, mobile push, desktop push.
- Per-user notification preferences, muting, or per-user thresholds.
- Deciding when a domain event happens — 011–016 and 051 own that.
- The management dashboard itself, the executive Kanban board, the quoting inbox, and Excel export (090).
- Predictive delay detection and AI anomaly detection (PRD §56, Phase 2).
- A working-hours / shift calendar.
- Multi-tier escalation ladders.
- A separate worker container or an external job queue.
- Renaming the `workitem.*` event types already emitted by 012/013/014.
- Sound/audible alerts.

## Dependencies

- **Consumes**:
  - **002**: `notify()` and the `NotificationEvent` table (read side), `WorkItem`, `WorkItemState`, `PhaseTiming` (the open queue segment that anchors workflow-phase waiting age), and the outbox contract's rule that recipient resolution is 053's job.
  - **001**: `getActor`, `authorize`, `audit.record`, the `Actor` shape (with its permission set and department memberships), and the frozen permission vocabulary. 053 introduces **no new permission key** — reading and marking one's own notifications needs no key; the Admin thresholds screen reuses `admin.config`; the notification-log view reuses `audit.view`.
  - **011**: `listReceptionQueue(actor, opts?)` with `opts.getDelayedWorkItemIds?: () => Promise<ReadonlySet<string>>` and `OrderQueueRow.delayed` — the reserved seam (011 FR-008a).
  - **051**: `pricing.status(workItemId)` and `pricing.pendingSince(workItemId)` (051 FR-014) and the `PricingStatus.waitingSince` column, which is the only delay clock tracked independently of workflow state.
  - **015**: `order.ready_for_collection`, `discrepancy.major`, `compensation.monetary_recorded`, and the customer-facing `customer.ready_for_collection` event that 053 must record but never display.
  - **016**: the seven `work_item.*` change-control events, whose payloads carry the full `SpecChangedEvent`.
  - **014 / 013 / 012**: `workitem.rejected`, `workitem.assigned`, and the revised-production-file event 053 defines on 014's behalf.
  - **091**: the five `ops.*` operational alert types and the `messageKey` rendering convention.
- **Provides**:
  - `notificationCenter.list(actor, filter)` · `notificationCenter.unreadCount(actor)` · `notificationCenter.markRead(actor, id)` · `notificationCenter.markUnread(actor, id)` · `notificationCenter.markAllRead(actor)`
  - `processOutboxBatch(limit)` and the guarded scheduler `startDelayScheduler()` / `stopDelayScheduler()` / `schedulerStatus()`
  - `getDelayedWorkItems(actor, filter)` returning age, phase, and responsible department per Work Item
  - `delayThresholds.read()` / `delayThresholds.update(actor, input)` and the thresholds admin screen
  - `<NotificationBell>`, `<NotificationDropdown>`, `<NotificationList>` and the `/notifications` page
  - The shared event catalog constants and the recipient-resolution port other features may target
- **Cross-contract**: 011 binds the delayed-work signal through its `opts` callback and works unchanged without it; 090 consumes `getDelayedWorkItems()` for the "Delayed Orders" tile; 054 reads the same outbox for customer messaging and must not consume 053's internal notifications.

## Notes for Planning

- `Notification` MUST be append-only in the sense that no user-facing path deletes it; archival (if ever needed) is a status change with an audit event, matching 001/052's void-with-reason precedent.
- The idempotency guarantee (FR-007) MUST be a database constraint, not application logic — a unique pair of (source event, recipient) — so a second process, a retry, or a bug cannot produce a duplicate. This is the same "let the schema refuse it" reasoning as 052's `FinanceVoid` uniqueness.
- The scheduler lease and the outbox claim are two different problems: the lease prevents *duplicate runs*, the unique constraint prevents *duplicate notifications*. Both are needed; neither alone suffices.
- Delay state is derived, never stored. `DelayBreach` is the only stored delay record, and it exists solely to make "once per breach" enforceable — it is not a status field on the Work Item.
- 053 must not import from `~/server/core`'s `Actor` (it lacks `permissions`); use `~/server/auth`'s.
- 053 must not block on 015, 016, or 091 code at compile time. Their event types are catalog entries, not imports.
- Backup scope: all 053 tables live in the existing primary PostgreSQL database and are covered by the existing DB backup set; 053 adds no new persistent store (constitution Backups).
- The additive `permissions` recipient mode (FR-002/FR-016) changes 002's published `NotifyEvent` shape and must be raised with Fady at plan time, since 002's contract was frozen with him.
