# Implementation Plan: Private File Storage & Versioning

**Branch**: `050-files` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/050-files/spec.md`

## Summary

Implement private, immutable file versioning for Work Items and generic attachments. Extend the existing 002 StorageAdapter with a local filesystem implementation that streams up to 5 GB to opaque object keys, computes SHA-256, deduplicates FileObject bytes, and persists FileAsset/FileVersion/Attachment metadata. Expose authenticated internal LAN links and short-lived preview grants. Enforce role, assignment, department, category/status, checksum, lifecycle, and audit rules on the server. Keep approval selection in 013 and backups in 091.

## Technical Context

**Language/Version**: TypeScript strict; existing Next.js App Router application.

**Primary Dependencies**: Prisma/PostgreSQL, existing 002 StorageAdapter, Better Auth `getActor`/`authorize`, 001 append-only `audit.record`, Zod, React, Vitest, Testing Library.

**Storage**: PostgreSQL metadata plus private local filesystem object store; configured LAN storage root. No remote backend in V1.

**Testing**: Vitest unit/contract/integration tests, route tests, streaming/memory benchmark, checksum/tamper tests, permission matrix tests, component tests, `pnpm check`.

**Target Platform**: Local LAN server and browser clients; large files transferred directly over LAN.

**Project Type**: Next.js web application with server-side file domain services and React UI.

**Performance Goals**: 2 GB upload without more than 200 MB additional process memory; 5 GB maximum; authorized version lookup/download usable in under 10 seconds for 90% of observed trials; signed preview expiry at approximately five minutes.

**Constraints**: No public URLs, no permanent deletion, no overwrites, no resumable upload in V1, configured MIME allowlist, server-only authority, checksum verification before delivery, audit every lifecycle mutation, local-first operation.

**Scale/Scope**: Files from small attachments through 5 GB print files; six Work Item categories; five generic attachment target types; many versions per FileAsset; 001/002 contracts consumed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Order → Work Item canonical model**: PASS. FileAsset belongs to Work Item; no alternate order identity or folder authority.
- **II. Business Gates Are Inviolable**: PASS. 050 does not choose approval; production access requires Approved/Production rules and department scope.
- **III. History Is Append-Only**: PASS. Versions are immutable; void/archive/supersede/approval are audited; no hard deletion.
- **IV. Files Are Immutable, Private Versions**: PASS. This feature directly implements immutable versions, private adapter storage, checksums, authorized routes, and no permanent public URLs.
- **V. Server Is the Only Authority**: PASS. Auth, authorization, validation, checksum, lifecycle, and audit execute server-side before streaming.
- **VI. Configuration Over Hard-Coding**: PASS. MIME allowlist and size policy are configured data/policy; categories are the explicit domain set.
- **VII. Local-First, Isolated Integrations**: PASS. Local LAN filesystem is the V1 backend; no Internet dependency or external integration.
- **VIII. AI Optional**: PASS. No AI dependency; design-file previews remain metadata-only.
- **IX. Arabic-First UX**: PASS. FilePanel is RTL, keyboard-accessible, and task-oriented.
- **Technology/data/security**: PASS. Existing TypeScript/Next/Prisma/PostgreSQL/Zod stack; migration and backup scope documented; private storage root remains configuration.

No gate violations.

## Project Structure

### Documentation

```text
specs/050-files/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── files.md
│   ├── storage.md
│   └── file-panel.md
└── tasks.md              # Created by /speckit-tasks
```

### Source Code

```text
prisma/schema/
├── core.prisma                 # existing WorkItem relation only if needed
└── files.prisma                # FileObject, FileAsset, FileVersion, Attachment, AuditEvent

src/server/files/
├── index.ts                    # frozen public barrel
├── schemas.ts                 # upload/query/lifecycle validation
├── service.ts                  # upload/list/approval/lifecycle
├── authorization.ts            # role/assignment/department/status policy
├── integrity.ts                # SHA-256 and stream verification (bounded memory)
├── signed-preview.ts           # five-minute HMAC grants
├── attachments.ts              # generic attachment service
├── preview.ts                  # image/PDF preview policy
└── observability.ts            # memory, upload duration, preview expiry diagnostics

src/server/core/storage/
└── local-disk.ts               # 050's production StorageAdapter implementation (opaque keys, verify-on-read)

src/app/api/files/
├── upload/route.ts
├── [versionId]/download/route.ts
├── [versionId]/preview/route.ts
└── [versionId]/lifecycle/route.ts

src/components/files/
├── file-panel.tsx
├── file-version-list.tsx
└── file-preview.tsx

tests/
├── unit/files/
├── contract/files/
├── integration/files/
├── performance/files/
└── components/files/
```

**Structure Decision**: Single Next.js application. Persistent metadata is Prisma-owned, bytes are behind the existing StorageAdapter, domain logic is server-side, routes are authenticated streaming boundaries, and FilePanel is reusable UI. No direct static storage exposure.

## Phase 0: Research Summary

Decisions are recorded in [research.md](research.md): stream to temporary opaque objects, deduplicate by SHA-256 while preserving versions, authenticated internal LAN links, no resumable V1, 5 GB/configured MIME policy, images/PDF previews only, and server-boundary authorization/integrity checks.

## Phase 1: Design Summary

- Entities/invariants: [data-model.md](data-model.md)
- File service contract: [contracts/files.md](contracts/files.md)
- Storage integration: [contracts/storage.md](contracts/storage.md)
- FilePanel UI contract: [contracts/file-panel.md](contracts/file-panel.md)
- Validation guide: [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- Immutable/private file versions: PASS.
- Server authority, permission scope, checksum verification, and audit transaction boundaries: PASS.
- Local-first storage and no external public links: PASS.
- Configuration and backup boundaries: PASS; 091 owns backup, while file metadata/object root are documented for inclusion.
- Arabic RTL FilePanel and accessible states: PASS.

No post-design violations.

## Complexity Tracking

No constitution violations. No additional complexity justification required.

## Configuration Schema

MIME allowlist, max file size, and department definitions are stored in `config/050-files.yaml` (YAML, validated at startup). Schema:

```yaml
mimeAllowlist: string[] (default: ['application/pdf','image/*','application/postscript','application/vnd.adobe.photoshop','application/vnd.adobe.illustrator','image/tiff','audio/*'])
maxFileSizeBytes: integer (default: 5_368_709_120 = 5 GB)
departments: { name: string, code: string }[] (managed by Admin UI)
previewExpirySeconds: integer (default: 300)
```

Runtime config loaded via `config/050-files.yaml`; overrides via env var `FILES_CONFIG_PATH`.
