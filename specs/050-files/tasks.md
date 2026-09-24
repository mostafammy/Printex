---

description: "Task list template for feature implementation"
---

# Tasks: Private File Storage & Versioning

**Input**: Design documents from `/specs/050-files/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included because the specification defines integrity, streaming, permission, lifecycle, audit, and UI acceptance criteria.

**Organization**: Tasks grouped by user story for independently testable increments.

## Phase 1: Setup

- [ ] T001 [P] Create `src/server/files/`, `src/components/files/`, `src/app/api/files/`, and file test directories from `specs/050-files/plan.md`.
- [ ] T002 [P] Add `prisma/schema/files.prisma` for FileObject, FileAsset, FileVersion, and Attachment without redefining WorkItem or User ownership.
- [ ] T003 [P] Add fixture helpers in `tests/fixtures/files.ts` for Work Items, actors, categories, streams, MIME types, checksums, and large-file benchmarks.
- [ ] T003b [P] Add `config/050-files.yaml` with MIME allowlist, max size, departments, preview expiry; add config loader in `src/server/files/config.ts`.

## Phase 2: Foundational

- [ ] T004 Define file categories/statuses, upload/lifecycle schemas, 5 GB limit, and configured MIME allowlist in `src/server/files/schemas.ts`.
- [ ] T005 [P] Implement stream-to-temporary-object and SHA-256/size calculation in `src/server/files/integrity.ts` without buffering whole files.
- [ ] T005b [P] [US1] Implement bounded-memory streaming in `src/server/files/integrity.ts`: TransformStream with highWaterMark=200MB, backpressure to client.
- [ ] T005c [P] [US1] Implement retry policy in `src/server/files/integrity.ts`: upload version with max 3 attempts, exponential backoff 100/200/400ms, 5s timeout.
- [ ] T006 [P] Implement local-disk StorageAdapter in `src/server/core/storage/local-disk.ts` with opaque hash/ID object keys, safe stream read/write operations, no-overwrite on put, and SHA-256 verification on get before yielding bytes.
- [ ] T006b [P] [US1] Implement SHA-256 verification on read in `src/server/core/storage/local-disk.ts`: get() computes streaming hash, compares to stored, throws on mismatch before yielding bytes.
- [ ] T007 [P] Implement file authorization policy in `src/server/files/authorization.ts`: Admin, assigned designer, same-department production operator for Approved/Production (department scope is configurable data), and forbidden cases.
- [ ] T008 [P] Implement five-minute HMAC preview grants in `src/server/files/signed-preview.ts`; bind grants to version/purpose/authorized scope and reject expiry/tampering.
- [ ] T009 Implement atomic FileObject/FileAsset/FileVersion metadata publication and append-only audit adapter in `src/server/files/service.ts`, consuming 001 `audit.record` and 002 StorageAdapter.
- [ ] T009b [P] [US1] Implement temp object sweeper in `src/server/files/sweeper.ts`: cron every hour, removes temp objects older than 1 hour, logs cleanup.
- [ ] T010 Create and apply Prisma migration in `prisma/migrations/` for file metadata, indexes, statuses, category constraints, Attachment polymorphic links, and AuditEvent; include private object-root backup documentation for 091.
- [ ] T010b [P] Add migration script in `prisma/migrations/` for legacy Work Items: create synthetic FileAsset per category with logicalName='Migrated', record legacy network paths.
- [ ] T011 Add route-level error mapping in `src/server/files/errors.ts` for validation, forbidden, missing, checksum mismatch, expired grant, incomplete upload, and size/MIME failures.

## Phase 3: User Story 1 - Upload a Safe, Traceable File Version (Priority: P1) 🎯 MVP

**Goal**: Stream large files into immutable, checksummed versions without overwriting history.

**Independent Test**: Upload `banner.pdf` twice; assert v1 SUPERSEDED, v2 ACTIVE, both FileVersion records retained, checksum metadata valid, and memory remains under 200 MB additional for a 2 GB stream.

### Tests

- [ ] T012 [P] [US1] Add normalization/filename/MIME/size tests in `tests/unit/files/upload-validation.test.ts`.
- [ ] T013 [P] [US1] Add stream checksum and interrupted-upload tests in `tests/unit/files/integrity.test.ts`.
- [ ] T014 [P] [US1] Add versioning/deduplication integration tests in `tests/integration/files/versioning.test.ts` proving shared FileObject bytes but independent FileVersion records.
- [ ] T015 [P] [US1] Add 2 GB memory benchmark in `tests/performance/files/streaming.bench.test.ts` asserting under 200 MB additional process memory.

### Implementation

- [ ] T016 [US1] Implement FileObject/FileAsset/FileVersion Prisma models and relations in `prisma/schema/files.prisma` with unique checksum/object constraints and monotonic version indexes.
- [ ] T017 [US1] Implement `files.upload(tx, input)` in `src/server/files/service.ts`: stream temporary bytes, hash/size, deduplicate FileObject, create next version, supersede prior ACTIVE, and audit.
- [ ] T018 [US1] Export upload/list services and frozen types from `src/server/files/index.ts`.
- [ ] T019 [US1] Add LAN upload route in `src/app/api/files/upload/route.ts` with authenticated actor, schema validation, streamed request handling, and no active version on failure.

**Checkpoint**: Large-file upload and immutable versioning work independently.

## Phase 4: User Story 2 - Find and Download Only Permitted Files (Priority: P1)

**Goal**: Stream only authorized, untampered files through authenticated internal routes and expiring previews.

**Independent Test**: Assigned designer succeeds; same-department production operator succeeds only for Approved/Production; other department gets 403; Admin succeeds; tampered bytes fail; expired preview fails.

### Tests

- [ ] T020 [P] [US2] Add authorization matrix tests in `tests/integration/files/authorization.test.ts` for Admin, assigned designer, same/other department production, status/category, and missing records.
- [ ] T021 [P] [US2] Add download/checksum tests in `tests/integration/files/download-integrity.test.ts` for streaming, tamper rejection, and zero-byte disclosure on denial.
- [ ] T022 [P] [US2] Add signed preview expiry/tamper tests in `tests/unit/files/signed-preview.test.ts`.

### Implementation

- [ ] T023 [US2] Implement authorized version listing and `files.getDownloadUrl(versionId, actor)` in `src/server/files/service.ts`.
- [ ] T024 [US2] Add authenticated streaming route in `src/app/api/files/[versionId]/download/route.ts` with re-authorization and SHA-256 verification before/during delivery.
- [ ] T024b [US2] Update download route with 64KB chunks, 30s per-chunk timeout, 5min total timeout; add to `tests/integration/files/download-streaming.test.ts`.
- [ ] T025 [US2] Add signed preview route in `src/app/api/files/[versionId]/preview/route.ts` and preview policy in `src/server/files/preview.ts` for image/PDF versus metadata/icon types. Preview route must include re-authorization and SHA-256 verification before/during delivery.

**Checkpoint**: File access is private, role-scoped, integrity-checked, and expiry-tested.

## Phase 5: User Story 3 - Review Versions and Lifecycle State (Priority: P1)

**Goal**: FilePanel supports version history and audited void/archive/supersede/approval boundaries.

**Independent Test**: Render categories/history, upload a new version, void/archive with reason, call markApproved from 013, and verify audit records and retained bytes.

### Tests

- [ ] T026 [P] [US3] Add lifecycle/audit tests in `tests/integration/files/lifecycle-audit.test.ts` for void/archive/supersede/approval, required reasons, before/after, and no permanent deletion.
- [ ] T027 [P] [US3] Add contract tests in `tests/contract/files/service-contract.test.ts` for upload, listVersions, markApproved, getDownloadUrl, and Attachment signatures.
- [ ] T028 [P] [US3] Add FilePanel component tests in `tests/components/files/file-panel.test.tsx` for six categories, keyboard controls, loading/empty/error states, and lifecycle actions.

### Implementation

- [ ] T029 [US3] Implement `files.listVersions`, `files.markApproved`, void/archive/supersede lifecycle operations in `src/server/files/service.ts` with atomic audit records.
- [ ] T029b [P] [US3] Implement Admin checksum verify/repair API in `src/app/api/files/admin/verify/route.ts` calling 091 backup.restoreObject/verifyChecksum; mark FileObject CORRUPTED on failure.
- [ ] T029c [P] [US3] Add 091 backup client in `src/server/files/backup-client.ts` with restoreObject and verifyChecksum methods.
- [ ] T030 [US3] Add lifecycle route in `src/app/api/files/[versionId]/lifecycle/route.ts` with reason validation and server authorization.
- [ ] T031 [US3] Implement `<FilePanel>` in `src/components/files/file-panel.tsx` with version list, upload/download/lifecycle controls, required reason field for void/archive actions, and RTL keyboard behavior.
- [ ] T031b [P] [US3] Optimize FilePanel: virtualize version list with @tanstack/react-virtual, memoize category tabs, lazy-load FilePreview with React.lazy.
- [ ] T032 [US3] Implement image/PDF preview and metadata/icon fallback in `src/components/files/file-preview.tsx` with RTL layout using logical properties (start/end), keyboard navigation.

**Checkpoint**: Staff can manage history without destructive file operations.

## Phase 6: User Story 4 - Attach Evidence to Operational Records (Priority: P2)

**Goal**: Generic voice/image/file attachments work for rejection, discrepancy, expense, audit, and message targets.

**Independent Test**: Attach each kind to each target type; authorized retrieval works, unauthorized retrieval fails, and permanent delete is unavailable.

### Tests

- [ ] T033 [P] [US4] Add attachment integration tests in `tests/integration/files/attachments.test.ts` for five target types and three kinds.
- [ ] T034 [P] [US4] Add attachment authorization/lifecycle tests in `tests/integration/files/attachment-security.test.ts`.

### Implementation

- [ ] T035 [US4] Implement `attachments.attach(tx, input)` and attachment listing in `src/server/files/attachments.ts` with shared FileObject deduplication and audit metadata.
- [ ] T036 [US4] Add attachment upload/download route boundaries in `src/app/api/files/attachments/route.ts` using owning-feature authorization.

**Checkpoint**: Generic evidence attachments work without feature-specific storage code.

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T037 [P] Add full quickstart acceptance coverage in `tests/integration/files/quickstart.test.ts`.
- [ ] T038 [P] Add storage path traversal/private-root tests in `tests/contract/files/storage-contract.test.ts`.
- [ ] T039 [P] Add memory, upload duration, and preview expiry diagnostics in `src/server/files/observability.ts`.
- [ ] T040 [P] Review RTL/accessibility and logical directional classes in `src/components/files/`.
- [ ] T041 Run `pnpm check`, `pnpm test`, Prisma migration validation, and `specs/050-files/quickstart.md`; record outcomes.
- [ ] T042 Update `specs/050-files/contracts/files.md`, `specs/050-files/data-model.md`, and `specs/050-files/quickstart.md` if implementation changes published behavior.

## Dependencies & Execution Order

- Setup precedes Foundational; Foundational blocks all stories.
- US1 is MVP and must establish schema, storage, streaming, and upload service before US2/US3.
- US2 depends on FileVersion metadata and authorization policy from US1/Foundation.
- US3 depends on listing/download contracts from US1/US2.
- US4 depends on shared FileObject/storage service but can proceed in parallel with US2/US3 after Foundation.
- Polish depends on all desired stories.

## Parallel Opportunities

- T001-T003 parallel.
- T005-T008 parallel after setup; T009-T011 follow shared decisions.
- T005b, T005c, and T006b parallel after T005/T006.
- US1 tests T012-T015 parallel.
- US2 authorization, integrity, and signed-grant tests parallel.
- US3 lifecycle, contract, and component tests parallel.
- US4 attachment/security tests parallel.
- Polish tests/accessibility/observability parallel.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1 streaming upload/versioning/deduplication.
3. Validate 2 GB memory target and `banner.pdf` version scenario.

### Incremental Delivery

1. Add private downloads/preview expiry (US2).
2. Add FilePanel/lifecycle/approval boundary (US3).
3. Add generic attachments (US4).
4. Run full Polish/quickstart validation.
