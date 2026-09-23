# Implementation Plan: Customer Finding & Management

**Branch**: `010-customers` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-customers/spec.md`

## Summary

Extend the existing core Customer model with normalized Egyptian phone lookup, Arabic-normalized name search, multiple phones/addresses, configurable classifications, audit-safe edits, archive behavior, immutable Cash Customer handling, selective cash-buyer promotion, profile tabs/slots, and the keyboard-friendly `<CustomerPicker>` contract. Use the existing TypeScript/Next.js/Prisma/PostgreSQL/Zod/Result/auth/audit patterns. Enforce all authorization, validation, uniqueness, and immutable-record rules on the server.

## Technical Context

**Language/Version**: TypeScript strict, existing repository version; React/Next.js App Router.

**Primary Dependencies**: Next.js, React, Prisma ORM, PostgreSQL, Better Auth, Zod, Tailwind CSS, Vitest, existing `Result`/typed domain errors, existing `authorize` and `audit.record` primitives.

**Storage**: PostgreSQL via Prisma multi-file schema; local-first LAN deployment. Customer phones, addresses, classifications, promotion records, and audit events are persistent operational data.

**Testing**: Vitest unit/integration tests, Testing Library for picker/profile behavior, `pnpm check` for lint/typecheck.

**Target Platform**: Local LAN server and browser clients; Arabic RTL internal operations UI.

**Project Type**: Next.js web application with server-side domain services and React UI.

**Performance Goals**: At least 95% of representative phone searches under 300 ms with 50,000 customers; bounded search results; picker usable during fast counter intake.

**Constraints**: Server is the only authority; no hard deletes; audit mutations with before/after; exactly one immutable Cash Customer; no Internet dependency for core workflow; UTC timestamps; EGP context where relevant; no merge in V1.

**Scale/Scope**: 50,000 customers for benchmark; multiple phones and addresses per customer; one Cash Customer; profile plus picker contracts; no payments, pricing, messaging, portal, or order-form implementation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Order → Work Item canonical model**: PASS. Extends the existing Customer relation; never creates alternate order ownership or nullable orders.
- **II. Business gates inviolable**: PASS. Customer actions do not bypass order workflow gates; promotion is explicit and audited.
- **III. History append-only**: PASS. Edits, archive, promotion, and reversal write audit events; no hard delete; Cash Customer is immutable.
- **IV. Files immutable/private**: PASS. No file behavior added.
- **V. Server only authority**: PASS. Server validation, authorization, phone uniqueness, Cash Customer protection, audit, and atomic mutations are required.
- **VI. Configuration over hard-coding**: PASS. Classification is configurable data, not an enum.
- **VII. Local-first isolated integrations**: PASS. Core customer behavior uses local application storage; no external service dependency.
- **VIII. AI optional**: PASS. No AI dependency.
- **IX. Arabic-first task-oriented UX**: PASS. Arabic RTL, logical layout, keyboard-friendly CustomerPicker, fast search/create flow.
- **Technology/data/security constraints**: PASS. Uses existing stack; schema changes use Prisma migrations; customer data remains in backup scope; auth/authz required.

No gate violations. No Complexity Tracking entry required.

## Project Structure

### Documentation (this feature)

```text
specs/010-customers/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── customer-service.md
│   ├── customer-picker.md
│   └── customer-profile.md
└── tasks.md              # Created by /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema/
│   ├── schema.prisma       # generator/datasource; unchanged
│   ├── core.prisma         # extend Customer, preserve Order relation
│   └── customer.prisma     # CustomerPhone, CustomerAddress, CustomerClassification, CustomerPromotion only
└── migrations/             # generated Prisma migration

src/server/
├── customers/
│   ├── normalizePhone.ts
│   ├── normalizeName.ts
│   ├── schemas.ts
│   ├── service.ts
│   ├── promotion.ts
│   └── index.ts
├── core/
│   ├── errors.ts           # reuse typed errors; add customer codes only if needed
│   └── ...
└── auth/                   # reuse authorize boundary

src/components/customers/
├── customer-picker.tsx
├── customer-profile.tsx
└── profile-slots.tsx

src/app/(shell)/customers/
├── page.tsx
└── [id]/page.tsx

tests/
├── unit/customers/
├── integration/customers/
└── components/customers/
```

**Structure Decision**: Single Next.js application. Customer persistence belongs in Prisma schema and server customer domain modules; customer UI belongs in reusable components plus shell routes. Tests follow existing Vitest conventions and must exercise server paths for authorization, duplicate protection, Cash Customer protection, and audit behavior.

## Phase 0: Research Summary

Research decisions are recorded in [research.md](research.md): normalized queryable records, server-boundary normalization/uniqueness, persisted Arabic search name, existing typed Result/auth/audit patterns, immutable Cash Customer with explicit promotion, V1 no merge, clarified Reception/Admin permissions, and stable consumer contracts. Customer mutations consume feature 001's append-only `audit.record` contract; this feature adds no replacement audit storage.

## Phase 1: Design Summary

- Entity definitions and invariants: [data-model.md](data-model.md)
- Server operations and mutation policy: [contracts/customer-service.md](contracts/customer-service.md)
- Order-entry picker contract: [contracts/customer-picker.md](contracts/customer-picker.md)
- Profile tab/extension contract: [contracts/customer-profile.md](contracts/customer-profile.md)
- Runnable validation scenarios: [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- **History and authority**: PASS. All mutations remain server-authorized, atomic with audit, and non-destructive.
- **Canonical order ownership**: PASS. Existing Customer/Order relation is extended, not replaced.
- **Configuration**: PASS. Classification uses data rows and inactive values remain historically valid.
- **Arabic-first UX**: PASS. Search normalization preserves display text; picker requires RTL and keyboard behavior.
- **Local-first/security**: PASS. No external runtime dependency; archived/customer identity data remains protected by auth scope.
- **Migration/backup**: PASS. Schema additions require Prisma migration and are included in DB backup scope.

No post-design violations.

## Complexity Tracking

No constitution violations. No additional complexity justification required.
