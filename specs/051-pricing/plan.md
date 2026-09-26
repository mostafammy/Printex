# Implementation Plan: Pricing Engine

**Branch**: `helmysaman8/pri-15-spec-plan-051-pricing` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

## Summary

051 adds an independent pricing module for Work Items. It consumes ProductType, Customer, and WorkItem data owned by neighboring features; owns price lists, customer rules, quote calculation, immutable WorkItemPrice history, PricingStatus, pricing queue/panel contracts, and pricing-originated returns; and prevents delivery through the existing 015 pricing port. Production is deliberately not blocked.

## Technical Context

**Language/Version**: TypeScript strict, Node 22.

**Primary Dependencies**: Next.js 15 App Router, Prisma/PostgreSQL, Zod, Vitest, existing 001/002/010/011/013/015/016 contracts.

**Storage**: PostgreSQL additive schema under `prisma/schema/`, delivered through a Prisma migration; Decimal-backed monetary fields; append-only commercial history and audit events.

**Module boundary**: New `src/server/pricing/` barrel is the only public import surface. Internal pricing calculation, configuration, status, ports, and guards/listener registration remain inside the module. UI surfaces live under existing shell/component conventions.

**Testing**: Unit tests for Decimal/unit/tier/date/rule selection; integration tests through server entry points for authorization, history, queue, status reset, and delivery port; contract tests for 015/016/013/001 seams. Tests are TypeScript files collected by Vitest.

**Constraints**:

- Money is Decimal, never Float.
- All calculations and authorization happen server-side.
- Pricing status is separate from WorkItem workflow state.
- Production may proceed while pricing is pending.
- 051 must not register a competing delivery guard.
- All mutations authorize and audit atomically.
- Arabic-first, task-oriented UI; `<PricingPanel workItemId>` is a contract, not a second pricing calculation.

## Constitution Check

| Principle | Result |
|---|---|
| I. Canonical Order → Work Item model | PASS: pricing attaches directly to WorkItem and consumes 011 fields. |
| II. Business gates are inviolable | PASS: 015 owns delivery enforcement; 051 supplies fail-closed pricing status. |
| III. History is append-only | PASS: WorkItemPrice and configuration values are retained; no destructive price rewrite. |
| IV. Files are immutable/private | PASS: no file storage is added. |
| V. Server is the only authority | PASS: quote, setPrice, status reset, and gate reads are server contracts. |
| VI. Configuration over hard-coding | PASS: units, tiers, effective dates, rules, and delay thresholds are configuration/data. |
| VII. Local-first/in-process integrations | PASS: 015/016/001/013 are in-process contracts; no cloud dependency. |
| VIII. AI optional | PASS: AI estimates explicitly excluded. |
| IX. Arabic-first UX | PASS: queue, panel, age, and breakdown are designed for the existing RTL shell. |

## Architecture and ownership

1. `src/server/pricing/calculation.ts` contains pure Decimal unit/area/linear calculations and final rounding.
2. `src/server/pricing/quote.ts` resolves active list/tier/customer rule and returns a breakdown without writing.
3. `src/server/pricing/prices.ts` owns authorized price setting, append-only history, status changes, and audit transaction ordering.
4. `src/server/pricing/status.ts` owns independent status and pending timestamp. `src/server/pricing/delivery-port.ts` owns the batched 015 `PricingGatePort` provider.
5. `src/server/pricing/queue.ts` owns server-side pending queue ordering and age projection: urgent items first, then oldest waiting timestamp within each priority group.
6. `src/server/pricing/returns.ts` composes 013's `createReturnInTx` for `PRICING_ISSUE` returns.
7. `src/server/pricing/change-listener.ts` registers `pricing.reset` with 016 and uses the supplied transaction.
8. `src/server/pricing/index.ts` exports the frozen public contract and performs guarded module-load bindings consistent with neighboring features.
9. Price list admin UI and customer special-pricing UI consume server actions/queries; they do not calculate amounts locally.

## Integration dependencies

- **001**: `authorize`, `audit.record`, and pricing permission vocabulary. Existing keys are `pricing.use_fixed`, `pricing.set_variable`, and `pricing.override`; changes require 001 coordination.
- **002**: WorkItem workflow and transition engine. 051 never writes workflow state directly.
- **010**: Customer identity and profile slot for special pricing.
- **011**: ProductType catalog and WorkItem quantity/dimension fields.
- **013**: Return model and `createReturnInTx`, with category `PRICING_ISSUE` and Pricing origin.
- **015**: `PricingGatePort`; 015 owns the delivery guard and maps unresolved pricing to `PRICING_UNRESOLVED`.
- **016**: `registerSpecChangeListener`; every accepted spec change resets pricing atomically.
- **053**: consumes `pendingSince` and configurable threshold for delay alerts.

## Project structure

```text
specs/051-pricing/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── checklists/requirements.md
└── contracts/
    ├── pricing-service.md
    ├── authorization-audit.md
    ├── delivery-gate.md
    ├── ui.md
    ├── returns.md
    └── spec-change-reset.md

src/server/pricing/                 # implementation planned by PRI-31
src/components/pricing/             # PricingPanel and queue surfaces
src/app/(shell)/pricing/             # queue/admin routes
prisma/schema/pricing.prisma        # additive pricing schema
prisma/schema/migrations/20260924170000_pricing/ # Prisma migration with constraints/backfill SQL (CLI reads prisma/schema/migrations/)
tests/{unit,contract,integration}/pricing/
```

## Delivery and reset sequencing

- 015's `READY_FOR_COLLECTION -> DELIVERED` guard invokes the bound, batched PricingGatePort. The provider returns `PRICED` only for a valid current price; PENDING/DISPUTED are unresolved.
- The 016 listener resets status after the new spec version is committed inside the caller transaction. It must not call external services, open nested transactions, or hide failures.
- If 015 or 016 are not present when implementation starts, tasks remain blocked at the contract boundary; 051 must not invent duplicate local semantics.

## Complexity Tracking

| Deviation | Why justified | Rejected simpler option |
|---|---|---|
| Separate PricingStatus and WorkItemPrice history | Status must remain independent from workflow and history must survive replacements. | A single nullable price field cannot represent pending age, disputes, or history. |
| Separate 015 port binding | Delivery ownership belongs to 015 and must fail closed when 051 is absent. | A 051 delivery guard would duplicate transition policy. |
| Customer rules separate from price-list rows | Customer overrides have different ownership and precedence. | Mutating list prices per customer destroys global history. |
| 016 listener reset | Spec changes can originate outside pricing and must reset atomically. | UI-triggered resets miss server-side changes. |

## Post-Design Check

The design preserves the constitution, has no unresolved implementation choice that changes scope, and leaves only owner-supplied rates/units and coordinated cross-feature availability as explicit prerequisites.
