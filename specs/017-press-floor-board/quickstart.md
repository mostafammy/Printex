# Quickstart: Validate the Press Floor Board

This proves 017 end to end. Contracts: [board-server](./contracts/board-server.md),
[live SSE](./contracts/board-live-sse.md), [engine](./contracts/board-engine.md),
[ink tokens](./contracts/ink-tokens.md). Data shapes: [data-model](./data-model.md).

## 0. Prerequisites

- PRI-66 merged (approved/priced Work Items auto-route). Without it, Review and Pricing never
  empty.
- 015 merged, for the Collection/Delivered drops. Without it, those columns are view-only (by
  design).
- `pnpm install`, then `pnpm test:db` (test database up), `pnpm db:migrate` (applies the trigger and
  permission migration), `pnpm prisma db seed`.

## 1. Automated suites

```sh
pnpm check                                   # lint + typecheck (a missing station placement fails here)
pnpm vitest run tests/unit/board             # store, commands, policies, LiveChannel, ink contrast, stations
pnpm vitest run tests/contract/board         # edge catalog × roles (SC-003), audit parity (SC-006), sendToProduction
pnpm vitest run tests/integration/board      # snapshot visibility, live NOTIFY commit/rollback, group move
pnpm vitest run tests/components/board       # JobTicket, MoveToMenu, sheets (jsdom)
pnpm vitest run tests/performance/board-snapshot.test.ts   # 500 cards, server part ≤ 600 ms
```

Expected: all green. `edge-catalog.test.ts` prints the edge × role matrix it verified.

## 2. Seed a demo floor

`node scripts/seed-board-demo.mjs`. This dev-only script (precedent: `scripts/seed-workflow-users.mjs`) uses the existing factories to create
about 60 Work Items across every non-terminal state and 3 departments, including one order with 4
items (3 priced, 1 pending) and one no-design item in `NEW`.

## 3. Manual walkthrough (two browsers, two users)

| # | As | Do | Expect |
|---|---|---|---|
| 1 | admin | open `/` | redirected to `/board`, the whole floor, 7 columns right-to-left, counts in headers |
| 2 | reception | open `/` | Reception + Collection slice (FR-021) |
| 3 | reception | drag the no-design `NEW` card | only Production and Cancel light up; drop → stamp in key ink → toast with link; the audit log has `workitem.sent_to_production` |
| 4 | head designer | drag a `WAITING_REVIEW` card to Design | the reject sheet asks for category + explanation; Esc → card flies back, nothing in the audit log; confirm → red arc into Design › Rework |
| 5 | designer (own design) | pick up their card in Review | "Approved" is never offered |
| 6 | any | pick up the pending-pricing card | Delivered is dimmed and shows "يجب حسم التسعير أولاً" |
| 7 | browser A + B | move a card in A | B sees it travel within 2 s (SC-004) |
| 8 | B | turn off Wi-Fi 10 s, then on | offline indicator, then "تم التحديث", with the board matching the server |
| 9 | A + B | both drag the same card | the second drop flies back with "نقلها <name>" |
| 10 | delivery | drag the 4-item order tag to Delivered | the hand-over sheet appears once; the summary shows 3 moved and 1 refused (pricing) |
| 11 | any | keyboard only: Tab to a ticket, `M`, choose a target | same result as a drag; the move is announced in Arabic |
| 12 | any | OS reduced motion on | moves are instant; no stamp, arc or roll-out |
| 13 | tablet | scroll a long lane quickly | no card is picked up; press and hold → lift |
| 14 | phone | open the board | one column at a time; moves through the "move to" list |
| 15 | any | ⌘K / Ctrl+K, type part of a customer name | the customer opens |
| 16 | admin | `/admin/health` | the "Board live updates" check is green, with a subscriber count |

## 4. Visual checks

- The same Work Item shows the same station ink on the board, the ticket and the detail page
  (US8-1).
- Grayscale (DevTools › Rendering › emulate vision deficiency: achromatopsia): station, state,
  urgency, overdue and pricing are still identifiable (SC-008).
- Dark theme: key ink renders as graphite and yellow text is still readable.

## 5. Idle check (SC-007)

Open the board and wait 10 s. In DevTools › Animations, no running animations. In the Performance
panel, no recurring frames.

## 6. Performance check (SC-005)

With the 500-card seed (`node scripts/seed-board-demo.mjs --count 500`), a cold load of `/board` must
reach usable in under 2 s on a shop-class machine. Drag across columns with the Performance panel
recording: no long tasks over 50 ms during the drag.
