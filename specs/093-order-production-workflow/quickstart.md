# Quickstart: Order Production Workflow (Phase 1 validation guide)

Prerequisites: `pnpm install`, Postgres running, Supabase project + env (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, private bucket), `prisma migrate deploy`, seed for ROLL class (width table, 80–120 range, Sulfan 90, 50 m cap), test users for each role.

## 1. Rounding + pricing vector

```bash
pnpm vitest run tests/unit/width-rounding tests/unit/roll-pricing
```

Expect: 75→80, 80→80, 81→110, 145→150, 150→150, 151→210, 250→260, 265→270, 271→320, 320→320, 321→WIDTH_ABOVE_MAXIMUM; 145cm×2m @100 + Sulfan = 300 + 270 = 570; heights >50 rejected; prices outside 80–120 rejected.

## 2. Full pipeline (integration)

```bash
pnpm vitest run tests/integration/pipeline-093
```

Scenario: reception creates ROLL item (145cm × 2m, 100/m², Sulfan) → preview shows 150cm / 3m² / 570 → assign designer → release (NEW→ASSIGNED) → designer uploads file → complete (→DESIGN_COMPLETED→WAITING_PRICING) → accountant approves (→READY_FOR_PRODUCTION) → printer sees item with production dims + approved file. Each step asserts audit event + same-tx persistence.

## 3. Forbidden-edge sweep (server path, must all fail cleanly)

```bash
pnpm vitest run tests/contract/pipeline-forbidden
```

Covers: release without designer; file-less completion; double submit; DESIGNER→PRINTER; DESIGN_COMPLETED→READY_FOR_PRODUCTION without accountant approval; non-accountant approval; review edge on `requiresReview=false` item; cross-department printer access; direct state-write bypass; price-out-of-range; width >320 without ticket; voided-file approval. Expect typed errors, zero state change.

## 4. Manual UI trace (RTL)

Reception → Designers → Accountant → Production queues: confirm requested→production width explanation, frozen breakdown display, file-version history, stage badges, and that hidden buttons match server refusals above.

Details: [data-model.md](data-model.md), [contracts/transitions.md](contracts/transitions.md), [contracts/pricing-rounding.md](contracts/pricing-rounding.md), [contracts/files-supabase.md](contracts/files-supabase.md), [contracts/queues.md](contracts/queues.md).
