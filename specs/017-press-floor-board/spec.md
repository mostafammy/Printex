# Feature Specification: Press Floor Board

**Feature Branch**: `017-press-floor-board`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Press Floor Board — a live board replacing the sidebar-first shell as Printex's home. Stations as columns in RTL flow (Reception → Design → Review → Pricing → Production → Collection → Delivered); Work Item cards grouped by Order; drag-to-transition that only offers legal moves and always goes through the existing server actions; quick sheets for moves that need input; group drag with a partial-result summary; live updates; role slices; a CMYK ink visual system; earned-moment motion only; keyboard parity; sidebar becomes an icon rail + command bar. Blocks V1 go-live. Linear: PRI-64 (spec), PRI-65 (implement)."

## Clarifications

### Session 2026-09-26 (pre-spec, with the product owner)

- Q: What does one card represent? → A: One Work Item. Work Items of the same Order carry a shared
  order tag and can be expanded together as a group.
- Q: What happens when a card is dropped on a move that needs input? → A: A quick sheet asks for the
  required fields. Confirm commits the move; cancel returns the card to where it was.
- Q: How does the board relate to the current sidebar and queue pages? → A: The board becomes the
  home screen. Each role lands on its own slice. The sidebar shrinks to an icon rail plus a command
  bar, and the existing queue pages stay as detail views.
- Q: How fast must other people's moves appear? → A: Live. Moves pushed from the server animate in
  on every open board.
- Q: Visual direction? → A: A CMYK "ink" system. Each station owns one print ink, and cards are
  styled as job tickets. It replaces the current Apple-derived look.
- Q: How much motion? → A: Earned moments only (stamp on drop, roll-out on completion, red rework
  arc). No ambient or looping motion.
- Q: Does Review get its own column? → A: Yes.
- Q: How is pricing shown, given it runs in parallel with production? → A: `WAITING_PRICING` is the
  Pricing column, and every card also carries a pricing-status badge. The Delivered column refuses
  drops while pricing is unresolved.
- Q: Can a whole Order group be dragged? → A: Yes. Every Work Item in the group that has a legal
  move to the target is moved. A summary sheet lists which items moved and which were refused, and
  why.
- Q: Is the board required for V1 go-live? → A: Yes. It blocks the go-live gate (PRI-37).
### Session 2026-09-26

- Q: When a Work Item doesn't need design, can the board move it from Reception straight to
  Production? → A: Yes. 017 adds an audited "send to production" action for the existing
  `NEW → READY_FOR_PRODUCTION` edge. It is allowed only when the Work Item does not require design,
  and is a plain drop with no sheet. Anyone holding the new "send to production" permission may do
  it. That permission is granted to Reception and Admin by default and can be granted to other users
  like any other permission.
- Q: Which part of the board does each role see first? → A: Role-focused slices. Reception →
  Reception + Collection. Designer → their own cards in Design. Head Designer → Review + Design.
  Production operator → their department's Production. Delivery staff → Collection + Delivered.
  Accounting → Pricing + every card with pricing pending. Admin → the whole floor.
- Q: Which print ink does each station get? → A: Reception Cyan · Design Magenta · Review Violet
  (spot) · Pricing Yellow · Production Key/Black (graphite in dark theme) · Collection Orange (spot)
  · Delivered Green (spot). Red is reserved for backward and destructive moves only.
- Q: Can a user undo a mistaken drop? → A: No undo. Moves save immediately. Mistakes are fixed by a
  normal, audited move where the workflow allows one. Plain drops show a toast naming what happened,
  with a link to the Work Item.
- Q: What devices will staff use the board on? → A: Desktop (mouse and keyboard), tablets with full
  touch drag and large targets, and phones with the one-column view and the "move to" list.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See where every job is at a glance (Priority: P1, MVP)

A staff member opens Printex and lands on the board. Every active Work Item they are allowed to see
is a card sitting in the column of the station currently responsible for it. Each card shows the
customer, the order it belongs to, what it is, how long it has been at this station, whether it is
urgent, and whether it has been priced. They can answer "where is this job now, and what is stuck?"
without opening anything.

**Why this priority**: This is the core business problem in the PRD: losing sight of a job as it
moves between departments. A read-only board already delivers that value before any drag exists.

**Independent Test**: Seed Work Items in every non-terminal state across several Orders. Open the
board as an admin and confirm each card appears in exactly one column and sub-lane per the
state → column map (FR-002). Confirm siblings share an order tag, and that `COMPLETED` / `CANCELLED`
items appear only when the archive filter is on.

**Acceptance Scenarios**:

1. **Given** Work Items in `NEW`, `IN_DESIGN`, `WAITING_REVIEW`, `WAITING_PRICING`,
   `IN_PRODUCTION`, `READY_FOR_COLLECTION` and `DELIVERED`, **When** an admin opens the board,
   **Then** each appears once, in the column and sub-lane FR-002 assigns to its state.
2. **Given** an Order with three Work Items in different states, **When** the board is shown,
   **Then** all three cards carry the same order tag, and expanding the tag highlights all three
   wherever they sit.
3. **Given** an urgent Work Item and a normal one in the same sub-lane, **When** the board is shown,
   **Then** the urgent one is listed first and visibly marked urgent (not by color alone).
4. **Given** a Work Item in `IN_PRODUCTION` whose pricing is still pending, **When** the board is
   shown, **Then** its card is in the Production column and carries a "pricing pending" badge.
5. **Given** a Work Item that has spent longer at its station than its expected time, **When** the
   board is shown, **Then** its time indicator shows it as overdue, with both a visual change and a
   text/icon cue.
6. **Given** a Work Item in `COMPLETED` or `CANCELLED`, **When** the board is shown with default
   filters, **Then** it does not appear; **When** the archive filter is turned on, **Then** it does.

---

### User Story 2 - Move a job forward by dragging it (Priority: P1)

A staff member picks up a card. The columns it can legally move to (for this Work Item, from its
current state, by this person) light up in their station's ink. Every other column dims and will not
accept it. They drop it, the card lands with a stamp, and the move is recorded exactly as if they
had pressed the equivalent button on the Work Item's page.

**Why this priority**: This is the interaction that turns the board from a report into the place
where work happens. Without it the board is only a dashboard.

**Independent Test**: As a Production operator, pick up a `READY_FOR_PRODUCTION` card in their
department. Confirm only "In production" and "Cancel" are offered as targets, drop on "In
production", and confirm the Work Item is `IN_PRODUCTION`. Confirm the recorded audit event is
identical in action, entity and fields to the one produced by the existing "start production"
button.

**Acceptance Scenarios**:

1. **Given** a card in any state, **When** a user picks it up, **Then** only targets that are both
   allowed by the workflow for the card's current state and permitted to this user are highlighted.
   All other columns are visibly dimmed and refuse the drop.
2. **Given** a highlighted target that needs no extra input, **When** the user drops the card,
   **Then** the card moves immediately (before the server confirms) with a stamp effect. The server
   then commits the move through the same action the existing button uses.
3. **Given** a drop the server refuses (a guard fails, or someone else already moved the card),
   **When** the refusal arrives, **Then** the card flies back to its original position and the
   server's reason is shown in Arabic.
4. **Given** a drop onto a column with more than one legal sub-lane for this card, **When** the
   user drops on the column header rather than a specific sub-lane, **Then** the user is asked to
   pick one; nothing is committed until they do.
5. **Given** a Designer dragging their own design, **When** they pick it up, **Then** "Approved" is
   never offered as a target (a designer can never approve their own work).
6. **Given** a Work Item whose pricing is unresolved, **When** any user picks it up, **Then** the
   Delivered column is dimmed and states that pricing must be resolved first.
7. **Given** a `NEW` Work Item that does not require design, and a user holding the "send to
   production" permission, **When** they drag it to Production, **Then** it becomes
   `READY_FOR_PRODUCTION` with no sheet and an audit event. **Given** the same item and a user
   without that permission, or a `NEW` item that requires design, **Then** Production is dimmed,
   and a forced request is refused by the server.

---

### User Story 3 - Moves that need information ask for it inline (Priority: P1)

Some moves cannot happen without information: rejecting a design needs a category and an
explanation; sending a job back from production needs a reason; cancelling needs a reason;
completing production needs the produced quantity; handing over to the customer needs hand-over
details. When the card is dropped on such a target, a small sheet opens next to it asking for
exactly those fields. Confirming commits the move. Cancelling returns the card with no change.

**Why this priority**: Without it, drag only covers the "happy path" moves, and the gates that
matter most (rejection, cancellation, pricing-before-delivery) would be reachable only from other
screens. Staff would stop trusting the board as the place to act.

**Independent Test**: As a Head Designer, drag a `WAITING_REVIEW` card onto Design (rework). Confirm
the sheet requires a rejection category and an explanation. Cancel it and confirm no server call,
no audit event, and the card back in Review. Repeat and confirm: the Work Item is
`REWORK_REQUIRED`, the rejection is recorded, and the designer is notified, exactly as the review
screen does it.

**Acceptance Scenarios**:

1. **Given** a drop on a target that needs input, **When** it happens, **Then** the card is held
   in a visibly "pending" position and a sheet asks for the required fields, with Arabic labels
   and validation.
2. **Given** an open sheet, **When** the user cancels (button, Escape, or clicking outside),
   **Then** the card returns to its original position and nothing is sent to the server.
3. **Given** an open sheet with a required field empty, **When** the user tries to confirm,
   **Then** confirmation is blocked with a message on the field, and nothing is sent.
4. **Given** a confirmed sheet, **When** the server accepts, **Then** the card lands with the stamp
   effect. **When** the server refuses, **Then** the sheet stays open with the server's reason so
   the user can correct and retry, or cancel.
5. **Given** a move whose input is too rich for a sheet (entering a price), **When** the card is
   dropped there, **Then** the Work Item's existing screen for that action opens, and the card
   stays put until that action is completed there.

---

### User Story 4 - See colleagues' moves as they happen (Priority: P2)

While a staff member has the board open, cards moved by anyone else — from the board or from any
other screen — glide from their old position to their new one, so the board is always the truth
without refreshing.

**Why this priority**: A board that goes stale quietly misleads people, which is worse than no
board. It is P2 only because US1–US3 are usable (with manual refresh) before it lands.

**Independent Test**: Open the board in two sessions as two users. Move a card in session A (by
drag, and separately by the existing button on a detail page). Confirm the card animates to its new
place in session B within the time in SC-004, without a refresh.

**Acceptance Scenarios**:

1. **Given** two open boards, **When** user A moves a card, **Then** user B sees it move to its new
   position within SC-004's time, animated from the old position (or instantly, under reduced
   motion).
2. **Given** a move made outside the board (for example on the review screen), **When** it
   commits, **Then** open boards update the same way.
3. **Given** a card user B is not permitted to see, **When** it moves, **Then** user B's board
   receives nothing about it.
4. **Given** user B loses connection for a while, **When** the connection returns, **Then** the
   board resynchronizes to the current truth and shows a brief "updated" notice, rather than
   replaying every missed move.
5. **Given** user B is holding a card mid-drag, **When** someone else moves that same card,
   **Then** B's drag is cancelled, the card animates to its real position, and B is told who
   moved it.

---

### User Story 5 - Move a whole order at once (Priority: P2)

A user drags an Order's group tag instead of a single card. Every Work Item in that Order that has
a legal move to the target is moved. Items that cannot move (wrong state, missing requirement, not
permitted) stay where they are. A summary sheet lists what moved and what was refused, and why.

**Why this priority**: Grouped orders (for example, all items of one order handed over together)
are common. Moving them one by one is tedious, but single-item drag (US2) already covers
correctness.

**Independent Test**: Seed an Order with four Work Items, three `READY_FOR_COLLECTION` with pricing
resolved and one with pricing pending. Drag the order group to Delivered and complete the hand-over
sheet once. Confirm three are `DELIVERED`, one is not, and the summary names the pending-pricing
item and its reason.

**Acceptance Scenarios**:

1. **Given** an Order group, **When** it is picked up, **Then** a target is highlighted if at least
   one of its Work Items has a legal move there, and the highlight shows how many of them would
   move (e.g., "3 of 4").
2. **Given** a group drop on a target that needs input, **When** it happens, **Then** one sheet
   collects the input once and it applies to every eligible item.
3. **Given** a group drop, **When** the server processes it, **Then** each Work Item's move is
   committed and audited individually, through the same action as a single move. A refusal of one
   item does not undo or block the others.
4. **Given** a completed group move, **When** results arrive, **Then** a summary sheet lists every
   Work Item in the group as moved, refused (with the reason), or not eligible (with the reason).

---

### User Story 6 - Each role opens on its own slice (Priority: P2)

Each role opens on the columns where its next action is (FR-021). A Designer sees their own cards
in Design. A Head Designer lands on Review and Design. A Production operator lands on their
department's Production work. Reception lands on Reception and Collection. Accounting lands on
Pricing plus every card with pricing pending. An admin sees the whole floor. Anyone can widen or narrow the view within what
they are permitted to see, and the board remembers their choice.

**Why this priority**: This follows constitution IX ("What do I need to do next?"). A full floor
is overwhelming for most roles, but the board is still correct without it (US1–US3).

**Independent Test**: Sign in as each role and confirm the landing slice, and that widening never
shows Work Items the role cannot see anywhere else in Printex.

**Acceptance Scenarios**:

1. **Given** a user with a single role, **When** they open Printex, **Then** the board opens on that
   role's default slice (FR-021).
2. **Given** a user with several roles, **When** they open Printex, **Then** they land on the slice
   of their highest-responsibility role and can switch slices in one action.
3. **Given** a user who narrowed or widened their view, **When** they return later, **Then** the
   board reopens with their last view.
4. **Given** any slice, **When** it is widened to the full floor, **Then** only Work Items this user
   is permitted to see anywhere else in Printex are shown.

---

### User Story 7 - Full keyboard and accessible operation (Priority: P2)

A user who does not or cannot use a mouse can do everything the board offers. They move focus
between cards, open a card's "move to" list, pick a legal target, fill a sheet, and confirm.
Color is never the only way a state, station, urgency, overdue or pricing status is conveyed.

**Why this priority**: Constitution IX, and staff under time pressure are often faster on the
keyboard. It is a go-live requirement, not a nice-to-have.

**Independent Test**: Complete US2's and US3's independent tests using only the keyboard, and
again with the operating system's reduced-motion setting on and in grayscale.

**Acceptance Scenarios**:

1. **Given** a focused card, **When** the user presses the "move" key, **Then** a list of only the
   legal targets for that card and user appears, and choosing one behaves exactly like dropping
   there.
2. **Given** reduced motion is requested by the operating system, **When** any move happens,
   **Then** cards change position without travel, stamp, arc or roll-out animation. The state
   change is still announced visually and to screen readers.
3. **Given** the board viewed in grayscale, **When** a user reads any card, **Then** station,
   state, urgency, overdue and pricing status are all still identifiable from text and icons.
4. **Given** any committed move, **When** it happens, **Then** assistive technology announces the
   card and its new state in Arabic.

---

### User Story 8 - The app feels like a print shop, and the sidebar gets out of the way (Priority: P3)

The board and the rest of the app adopt the ink visual system. Each station owns one print ink,
and that ink follows a Work Item wherever it appears (board column, card edge, badges, order and
detail pages). Cards look like physical job tickets. The large sidebar becomes a narrow icon rail,
and a command bar lets anyone jump to any page, order, customer or Work Item by typing.

**Why this priority**: This is the identity and delight layer. US1–US7 work with plain styling, so
this is layered on last, but it is still in scope for go-live.

**Independent Test**: Open the board, a Work Item detail page and the order page for the same item.
Confirm the station ink is the same on all three. Open the command bar with its shortcut, type part
of a customer name, and jump to it.

**Acceptance Scenarios**:

1. **Given** a Work Item in Production, **When** it is shown on the board, its detail page, and its
   order page, **Then** all three use Production's ink for that item's station marking.
2. **Given** a card lands after a move, **When** motion is allowed, **Then** it plays a short stamp
   effect in the new station's ink. **When** a Work Item becomes `COMPLETED`, **Then** its card
   plays a roll-out effect and leaves the board. **When** a move sends work backwards (rework or
   send-back), **Then** a red arc traces the backward move.
3. **Given** the board is idle, **When** nothing is happening, **Then** nothing on screen is
   animating.
4. **Given** any page, **When** the user presses the command-bar shortcut, **Then** a search opens
   that finds pages, orders, customers and Work Items the user can access, in Arabic, and opens
   the chosen one.
5. **Given** the shell, **When** a user hovers or focuses a rail icon, **Then** its Arabic label is
   shown. All pages previously reachable from the sidebar remain reachable from the rail or command
   bar.

---

### Edge Cases

- **Race on the same card**: Two users drop the same card at nearly the same time. The first commit
  wins. The second user's card flies back with "already moved by <name> to <state>".
- **State changed while a sheet is open**: The Work Item changes state (someone else moved it)
  while a user is filling a sheet for it. On confirm, the server refuses. The sheet shows the new
  state and offers only "close", and the card animates to its true position.
- **System-driven moves**: Some transitions are never done by a person. After "mark design
  complete" the system routes to review or approval. An approved item is routed to pricing or
  production. Financial closure completes delivered items. These are never offered as drag targets,
  but they appear live on the board when they happen.
- **Chained moves**: One user action can cause two state changes (e.g., design complete → waiting
  review). The card travels once, to its final position, not through each intermediate one.
- **Rework landing**: A rejected item lands in Design's "Rework" sub-lane (`REWORK_REQUIRED`) with
  the red arc, and carries a visible rework count.
- **Card with no station owner visible to the user**: A user may see an Order's tag, but not every
  sibling Work Item. Expanding the order says how many siblings are hidden, without showing them.
- **Order group containing cancelled items**: Cancelled siblings are excluded from group moves and
  listed as "not eligible — cancelled" in the summary.
- **Large volume**: A station column holds hundreds of cards. The column stays scrollable and
  responsive, and a count is always shown in the column header.
- **Dragging near the edge**: On screens where not all columns are visible (including tablets),
  dragging toward the edge scrolls the board. On phone width, drag is replaced by the "move to"
  list (FR-035).
- **Server unreachable**: Committing a move fails due to connection loss. The card flies back with
  "not saved — connection lost", and the board shows an offline indicator until the connection
  returns.
- **Permissions revoked mid-session**: A user's role changes while the board is open. The next
  resync removes cards and targets they can no longer see or act on.
- **Right-to-left**: Work flows from the start edge (right, in Arabic) toward the end edge (left).
  Arrows, arcs and "fly back" directions follow the reading direction, never a hard-coded
  left/right.

## Requirements *(mandatory)*

### Functional Requirements

**Board structure**

- **FR-001**: The system MUST provide a board as the default landing screen after sign-in, with
  seven station columns in reading order: Reception, Design, Review, Pricing, Production,
  Collection, Delivered.
- **FR-002**: Every Work Item state MUST map to exactly one column and sub-lane:

  | Column | Sub-lanes (state) |
  |---|---|
  | Reception | New (`NEW`) |
  | Design | Assigned (`ASSIGNED`), In design (`IN_DESIGN`), Rework (`REWORK_REQUIRED`), Done (`DESIGN_COMPLETED`) |
  | Review | Waiting review (`WAITING_REVIEW`), Approved (`APPROVED`) |
  | Pricing | Waiting pricing (`WAITING_PRICING`) |
  | Production | Ready (`READY_FOR_PRODUCTION`), In production (`IN_PRODUCTION`) |
  | Collection | Arriving (`PRODUCTION_COMPLETED`), Ready for customer (`READY_FOR_COLLECTION`) |
  | Delivered | Delivered (`DELIVERED`) |
  | *(off-board, archive filter)* | Completed (`COMPLETED`), Cancelled (`CANCELLED`) |

  Adding a new state to the workflow without assigning it here MUST fail the build or the test
  suite, rather than silently hiding cards.
- **FR-003**: Each card MUST represent exactly one Work Item and show, at minimum: customer name,
  order reference, product/Work Item title, quantity, current state label (Arabic), time at the
  current station, urgency, pricing status, and (for rework) the rework count.
- **FR-004**: Work Items of the same Order MUST share a visible order tag. Activating the tag MUST
  highlight all sibling cards the user can see and state how many siblings are hidden from them.
- **FR-005**: Within a sub-lane, urgent Work Items MUST be listed before normal ones. Within the
  same urgency, the Work Item that has waited longest MUST come first.
- **FR-006**: Each column header MUST show its count of visible cards.
- **FR-007**: Each card MUST show time at its current station against the expected time for that
  station (from existing time tracking), and MUST mark overdue items with both a visual and a
  text/icon cue.
- **FR-008**: Each card MUST show a pricing-status badge (e.g., pending / priced) in every column,
  independently of which column it is in.
- **FR-009**: `COMPLETED` and `CANCELLED` Work Items MUST be hidden by default and shown only through
  an archive filter.
- **FR-010**: Opening a card MUST lead to the Work Item's existing detail screen. Existing queue and
  detail pages MUST remain available.

**Moving work**

- **FR-011**: When a card is picked up (by pointer, touch or keyboard), the system MUST offer as
  targets only those moves that are (a) allowed by the workflow from the card's current state,
  (b) user-initiated (not system-driven — see Edge Cases), and (c) permitted to this user by the
  same permission and guard rules the server enforces. All other columns MUST be visibly dimmed
  and MUST NOT accept the drop.
- **FR-012**: The on-screen check in FR-011 is guidance only. Every move MUST be committed through
  the same server action that the existing screens use for that move, and MUST be refused by the
  server if any rule fails, regardless of what the board offered.
- **FR-013**: A move committed from the board MUST produce exactly the same state change, audit
  events, notifications and side effects as the same move made from the existing screens.
- **FR-014**: A drop on a target that needs no input MUST update the board immediately and then
  confirm with the server. If the server refuses, the card MUST return to its original position and
  the server's reason MUST be shown in Arabic. On success, a brief notice MUST name the Work Item and
  its new state and link to it.
- **FR-014a**: The board MUST NOT offer undo. A committed move is corrected only by another
  legitimate, audited move that the workflow allows (constitution III). No move may be delayed to
  allow cancelling it.
- **FR-015**: A drop on a target that needs input MUST open a sheet requesting exactly the inputs
  the underlying action requires, validated before anything is sent. This covers at least:
  rejecting a design (category and explanation, optional attachments), sending back from production
  (reason), cancelling (reason), completing production (produced quantity), assigning a designer
  (designer choice), and handing over to the customer (hand-over details as defined by the
  collection and delivery feature). Cancelling the sheet MUST send nothing and restore the card.
- **FR-015a**: The system MUST provide a "send to production" move for the existing
  `NEW → READY_FOR_PRODUCTION` edge. It MUST (a) be allowed only for Work Items that do not require
  design, (b) be authorized by a dedicated "send to production" permission, granted by default to the
  Reception and Admin roles and grantable to other users through the existing permission
  configuration, (c) need no sheet, and (d) be audited like every other transition. Work Items that
  require design MUST never be offered this move, and the server MUST refuse it if forced. This is
  the only new server-side move 017 introduces; it adds no new state or edge.
- **FR-016**: For moves whose input cannot reasonably fit a sheet (entering or approving a price),
  a drop MUST open the Work Item's existing screen for that action. The card MUST stay in place
  until that action is completed.
- **FR-017**: The Delivered column MUST refuse drops of any Work Item whose pricing is unresolved,
  and MUST say so when the card is picked up.
- **FR-018**: When a move goes backwards in the flow (rework, send-back to design), the board MUST
  show it distinctly from forward moves.
- **FR-019**: A user MUST be able to drag an Order group. The system MUST attempt the move for each
  eligible Work Item in the group individually, collect any required input once, commit and audit
  each item separately, never let one item's refusal block the others, and then show a summary
  listing every item as moved, refused (with reason) or not eligible (with reason).
- **FR-020**: Every move possible by drag MUST also be possible by keyboard, through a "move to"
  list offering the same targets as FR-011.

**Views and live updates**

- **FR-021**: The board MUST open on a default slice per role:

  | Role | Default slice |
  |---|---|
  | Reception | Reception + Collection columns |
  | Designer | Their own assigned Work Items in the Design column |
  | Head Designer | Review + Design columns |
  | Production operator | Production column, their department only |
  | Delivery staff | Collection + Delivered columns |
  | Accounting | Pricing column + every card whose pricing is pending, wherever it is |
  | Admin | The whole floor |

  Users with several roles land on the slice of their highest-responsibility role (Admin > Head
  Designer > Accounting > Reception > Delivery staff > Production operator > Designer) and can switch
  to any of their roles' slices in one action.
- **FR-022**: Users MUST be able to narrow the board (by station, department, designer, urgency,
  overdue, pricing status, customer) and widen it. The board MUST never show a Work Item the user is
  not permitted to see elsewhere in Printex.
- **FR-023**: The board MUST remember each user's last view and filters per device.
- **FR-024**: Every Work Item state change the user is permitted to see, from any source, MUST be
  reflected on their open board without a refresh. The card animates from its old position to its
  new one.
- **FR-025**: After a lost connection, the board MUST resynchronize to the current state instead of
  replaying missed changes, and MUST show an indicator while disconnected.
- **FR-026**: If a card being dragged or held in an open sheet is moved by someone else, the board
  MUST cancel the local action, move the card to its true position and name who moved it.

**Visual system, motion and shell**

- **FR-027**: The application MUST adopt an ink visual system in which each station has exactly
  one assigned ink:

  | Station | Ink |
  |---|---|
  | Reception | Cyan |
  | Design | Magenta |
  | Review | Violet (spot) |
  | Pricing | Yellow |
  | Production | Key / Black (rendered as graphite in the dark theme) |
  | Collection | Orange (spot) |
  | Delivered | Green (spot) |

  That ink MUST be used consistently for that station on the board, on cards and on every other
  page that shows a Work Item's station, in both light and dark themes. Where an ink cannot meet
  FR-029 contrast as text (e.g., yellow on white), a darker shade of the same ink MUST be used for
  text and icons while the full ink is kept for fills and edges.
- **FR-027a**: Red MUST be reserved for backward and destructive meaning: rework, send-back,
  cancellation, refusals and overdue. No station may use red, and red MUST NOT be used decoratively.
- **FR-028**: The existing Apple-derived visual tokens and surface styles MUST be replaced by the ink
  system across the application, not only on the board.
- **FR-029**: All text and meaningful graphics MUST meet WCAG 2.1 AA contrast in both themes.
  Station, state, urgency, overdue and pricing status MUST never be conveyed by color alone.
- **FR-030**: Motion MUST be limited to these moments: a card landing after a move (stamp), a Work
  Item reaching `COMPLETED` (roll-out), a backward move (red arc), cards relocating due to others'
  moves (travel), and the direct feedback of picking up and dragging. Nothing may animate while the
  board is idle.
- **FR-031**: When the operating system requests reduced motion, all movement listed in FR-030
  MUST be replaced by instant changes, and state changes MUST still be clearly indicated.
- **FR-032**: Committed moves MUST be announced to assistive technology in Arabic (card and new
  state).
- **FR-033**: The sidebar MUST be replaced by a narrow icon rail with Arabic labels on hover/focus,
  and a command bar opened by a keyboard shortcut (and a visible button). The command bar MUST find
  pages, orders, customers and Work Items the user can access. Every page reachable from today's
  sidebar MUST remain reachable.
- **FR-034**: The whole board, including directions of flow, travel, fly-back and arcs, MUST follow
  the reading direction (RTL in Arabic) and use no hard-coded left/right.
- **FR-035**: The board MUST support three device classes:
  (a) **desktop**: mouse and keyboard drag;
  (b) **tablet**: full touch drag, with a deliberate press-and-hold to pick up a card, so that
  scrolling never picks one up by accident, and touch targets of at least 44×44 CSS px;
  (c) **phone**: one column at a time, with moves made through the "move to" list instead of drag.
  Every capability of the board MUST be available on all three.

### Key Entities

- **Station**: One board column: a named stage of the print floor owned by a role or department.
  Attributes: Arabic name, order in the flow, assigned ink, icon, and the Work Item states (sub-lanes)
  it contains. Stations are a presentation grouping over the existing workflow; they add no new
  states.
- **Sub-lane**: A subdivision of a station corresponding to exactly one Work Item state, with its
  own Arabic label.
- **Board card**: The on-board representation of one Work Item (see FR-003). It is not stored;
  it is derived from the Work Item, its Order, its customer, pricing status and time tracking.
- **Order group**: The set of an Order's Work Items visible to a user, shown through a shared tag.
  It is the unit of a group drag.
- **Move**: A user's request to take a Work Item (or group) from its current state to a target
  state. It maps one-to-one to an existing server action, carries any sheet input, and results in
  accepted or refused (with reason).
- **Board view**: A user's saved slice and filters (per device).
- **Board update**: A notice that a Work Item the user may see has changed state: which item,
  from what, to what, by whom, when. It drives live updates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A staff member can find where any given active Work Item is, starting from the home
  screen, in under 10 seconds, in at least 9 of 10 attempts during acceptance testing with shop
  staff.
- **SC-002**: A simple forward move (no input needed) takes one drag or three keystrokes, and the
  card is visibly in its new place in under 100 ms after the drop.
- **SC-003**: Zero moves offered by the board are illegal, and zero illegal moves succeed. In
  testing, every workflow edge × every role combination either appears as a target and succeeds,
  or does not appear and is refused by the server if forced.
- **SC-004**: A move made by one user appears on every other open board that may see it within
  2 seconds on the shop's local network.
- **SC-005**: The board opens with up to 500 active Work Items in under 2 seconds on a typical shop
  workstation, and scrolling and dragging stay smooth.
- **SC-006**: Every move from the board produces an audit record identical (apart from time and
  identifiers) to the same move from the existing screens, for 100% of user-initiated workflow
  edges.
- **SC-007**: With the board idle, nothing on screen animates.
- **SC-008**: Every board task in US2, US3, US5 and US7 can be completed with keyboard alone, and
  with reduced motion on, and with the screen in grayscale.
- **SC-010**: Every board task in US2, US3 and US5 can be completed by touch on a tablet and through
  the "move to" list on a phone. In tablet testing, scrolling a column never picks up a card by
  accident.
- **SC-009**: After two weeks in use, staff report the board as their main way of checking and moving
  work (at least 4 of 5 roles, via a short survey or observation).

## Assumptions

- **Dependencies**: The board only calls existing move actions from 011 (orders/reception), 012
  (designer assignment/timers), 013 (review/rework), 014 (production), 015 (collection/delivery),
  016 (change control) and 051 (pricing). Collection and delivery moves (015) must exist before those
  columns accept drops. Until then, those columns are view-only.
- **No workflow changes**: This feature adds no states, edges or business rules. Station columns
  and sub-lanes are presentation only (constitution I). The single exception is FR-015a: one new
  action and permission for an edge that already exists but that nothing could perform.
- **System-driven transitions**: "Design complete → waiting review / approved", "approved → waiting
  pricing / ready for production" and "delivered → completed" are performed by the system as today
  and are never drag targets. The plan MUST classify every workflow edge as board-droppable (with
  its existing action and inputs), detail-screen-only (FR-016), or system-driven.
- **Pricing**: Entering or approving a price stays on the existing pricing screen (FR-016). The
  board shows the Pricing column and badges only.
- **Volume**: A single shop has at most a few hundred active Work Items at once. SC-005 uses 500 as
  headroom.
- **Deployment**: Live updates are delivered within the shop's local deployment. The mechanism, and
  whether more than one server instance must be supported, are planning decisions.
- **Saved views**: Per-device saved views are enough for V1. Syncing views across devices is out of
  scope.
- **Out of scope**: Sound effects; management KPIs and charts (090 dashboard); customer-facing views;
  editing Work Item content from the card (only moves); reordering cards manually within a sub-lane.
- **Default slices**: The role → slice mapping in FR-021 was confirmed by the product owner. The
  multi-role precedence order is a reasonable default.
