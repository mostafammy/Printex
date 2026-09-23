# Customer Feature Validation Guide

## Prerequisites

- Node.js and pnpm installed.
- PostgreSQL available through `DATABASE_URL`.
- Dependencies installed with `pnpm install`.
- Prisma client/schema from the existing 002 feature available.

## Static checks

```bash
pnpm check
pnpm test
```

Expected: lint, typecheck, and Vitest suites pass.

## Database setup

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

Expected: exactly one Cash Customer exists; starter classifications exist; existing core seed data remains valid.

## Required automated scenarios

1. **Phone normalization**
   - Test `01012345678`, `+201012345678`, `00201012345678`, and spaced/dashed variants.
   - Expected: identical canonical E.164 output.
   - Test invalid length/prefix and unsupported characters.
   - Expected: validation error and no persistence.

2. **Duplicate protection**
   - Create a customer with a primary phone.
   - Attempt a second customer using any equivalent phone representation.
   - Expected: existing customer is returned/referenced; second creation is blocked.

3. **Search**
   - Search by primary and alternate phones, full and partial.
   - Search Arabic variants such as `أحمد`/`احمد`, `ة`/`ه`, `ى`/`ي`, with tashkeel.
   - Expected: intended customer appears; display name remains unchanged.
   - Run the 50,000-customer benchmark.
   - Expected: at least 95% of phone searches complete under 300 ms.

4. **Audit and archive**
   - Edit each supported customer field.
   - Expected: before/after audit event for every edit.
   - Archive as Admin, then search normally and through history.
   - Expected: hidden by default, retained in history, no hard delete.

5. **Cash Customer**
   - Attempt edit, rename, archive, merge.
   - Expected: server-side rejection.
   - Create multiple Cash Customer orders.
   - Expected: each remains individually identifiable.

6. **Promotion**
   - Create a real customer from a cash buyer and select only some Cash Customer orders.
   - Expected: selected orders re-link, other orders stay Cash Customer, audit event exists.
   - Reverse as Admin.
   - Expected: selected links restore, reversal audit event exists.

7. **CustomerPicker**
   - Search, navigate with keyboard, select a result.
   - Expected: `onSelect(customerId)` fires once.
   - Create inline with valid fields.
   - Expected: created ID is returned.
   - Trigger duplicate, loading, empty, validation, unauthorized, and server-error states.

## Contract references

- Service behavior: [contracts/customer-service.md](contracts/customer-service.md)
- Picker behavior: [contracts/customer-picker.md](contracts/customer-picker.md)
- Profile slots: [contracts/customer-profile.md](contracts/customer-profile.md)
- Entities/invariants: [data-model.md](data-model.md)
