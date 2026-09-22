# Quickstart: 001-identity-access-audit

## Prerequisites

- `pnpm install` done, `.env` has `DATABASE_URL`/`DATABASE_URL_TEST`/`STORAGE_ROOT` set (per 002).
- `pnpm exec prisma migrate dev` applied (includes this feature's identity/audit tables + the
  `REVOKE UPDATE, DELETE ON audit_event` migration).
- `pnpm run seed` run — seeds the 7 roles × permission matrix (data-model.md), the 5 departments
  (already seeded by 002, unchanged), and at least one Admin/Owner user with a known
  username/password for local login.

## Scenario 1 — Login and role-scoped authorization (User Story 1)

```bash
pnpm dev
```

1. Open the login page, sign in as the seeded Designer user.
2. Confirm `getActor()` resolves (e.g. via a temporary `console.log` in a server action, or the
   shell layout's actor-dependent nav) to `roles: ["DESIGNER"]` and a permission set containing
   `design.work`/`design.review`'s *absence* (Designer never gets `design.review`).
3. Attempt to call a server action gated on `pricing.set_variable` directly (e.g. via a scratch
   test script, not the UI) while logged in as Designer — expect a `FORBIDDEN` `DomainError`.
4. Log out; confirm a subsequent `getActor()` call rejects `UNAUTHENTICATED`.

## Scenario 2 — Admin user/session management (User Story 2)

1. Log in as the seeded Admin.
2. Create a new user with role Production Operator and department Banner.
3. Log in as that new user in a second browser/incognito session; confirm they can authenticate.
4. As the Admin, deactivate that user.
5. In the second session, trigger any server action; confirm it now rejects `UNAUTHENTICATED`
   (session revoked within one request, not merely "will expire eventually" — SC-002).
6. Confirm the Users screen shows no delete action anywhere, and the Departments screen shows no
   delete action anywhere.

## Scenario 3 — Audit trail integrity (User Story 3)

1. Perform the Scenario 2 actions (user create + deactivate) and open the Audit Log.
2. Filter by action `user.created`; confirm one event with the correct actor/timestamp/`after`
   snapshot.
3. Connect directly to Postgres (`psql $DATABASE_URL`) as the application's role and run:
   ```sql
   UPDATE audit_event SET reason = 'tampered' WHERE id = (SELECT id FROM audit_event LIMIT 1);
   ```
   Expect a permission-denied error from Postgres itself, not from the application.
4. Repeat with `DELETE FROM audit_event WHERE id = (SELECT id FROM audit_event LIMIT 1);` — same
   expected rejection.

## Automated verification

- `pnpm check` — lint + typecheck must pass.
- `pnpm test` — includes the role×permission snapshot test (SC-001), the department-scope
  `FORBIDDEN` test (SC-006), the session-revocation test (SC-002), and a contract-level test that
  issues raw SQL `UPDATE`/`DELETE` against `audit_event` inside the test database and asserts
  Postgres rejects both (SC-003).
