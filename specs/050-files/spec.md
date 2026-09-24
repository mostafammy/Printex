# Feature Specification: Private File Storage & Versioning

**Feature Branch**: `050-files`
**Created**: 2026-09-23
**Status**: Draft
**Input**: User description: "PRI-14 — Spec & plan: 050-files. Define private, versioned, checksummed files per Work Item behind a storage abstraction, signed short-lived access, archive/void instead of delete, and generic attachments."
**PRD References**: §39–44

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload a safe, traceable file version (Priority: P1)

A designer uploads a source or design file to a Work Item. The system stores it as a new immutable version, records who uploaded it and why, computes its checksum, and never overwrites an earlier version.

**Why this priority**: Version history replaces unsafe Windows folders and protects approved work from accidental replacement.

**Independent Test**: Upload the same `banner.pdf` twice and verify two versions exist, both bytes remain downloadable, the first becomes SUPERSEDED, and checksums/metadata are recorded.

**Acceptance Scenarios**:

1. **Given** a Work Item and valid upload, **When** a designer uploads a file, **Then** a new FileAsset/FileVersion is created with the next version number, metadata, checksum, actor, note, and category.
2. **Given** an existing version, **When** another upload uses the same logical file, **Then** the new upload is a new version and the old bytes are not overwritten.
3. **Given** a multi-gigabyte upload, **When** it completes, **Then** the process remains within the approved memory budget because bytes are streamed rather than loaded wholly into memory.
4. **Given** bytes changed on disk after upload, **When** the file is read, **Then** checksum verification detects tampering and refuses delivery.

---

### User Story 2 - Find and download only permitted files (Priority: P1)

A staff member sees files appropriate to their role and department. Production can download only Approved or Production files for Work Items in their department; assigned designers can access files for their Work Items; Admin can access all authorized files.

**Why this priority**: Private file access is a production and security gate; an incorrect download can send the wrong artwork to production.

**Independent Test**: Exercise downloads as an assigned designer, a production operator in the correct department, an operator in another department, and Admin; verify permitted requests stream and unauthorized requests return 403.

**Acceptance Scenarios**:

1. **Given** an authenticated authorized actor, **When** they request a file download, **Then** the application authenticates, authorizes against the Work Item/category/status, verifies integrity, and streams the bytes.
2. **Given** a production operator from another department, **When** they request an Approved/Production file, **Then** the request is rejected with 403 and no bytes are disclosed.
3. **Given** a preview request, **When** an authorized actor receives a signed URL, **Then** the URL expires after 5 minutes (300 seconds) and stops working afterward.
4. **Given** an unauthorized or missing file, **When** a request is made, **Then** the response does not reveal whether a protected file exists.

---

### User Story 3 - Review versions and lifecycle state (Priority: P1)

A designer or manager uses `<FilePanel>` to review versions, notes, upload a new version, download an allowed version, and mark a version void or archived with a reason. Head Designer/feature 013 can mark an approved version without this feature deciding approval.

**Why this priority**: Staff need an operational history and controlled lifecycle instead of folder-name conventions.

**Independent Test**: Render FilePanel for each category, list versions with actor/time/note/status, upload a new version, void/archive one with a reason, and verify every lifecycle mutation is audited.

**Acceptance Scenarios**:

1. **Given** a Work Item with versions, **When** FilePanel opens, **Then** categories and version history show version number, original name, uploader, time, note, status, and approved state.
2. **Given** a version, **When** an authorized user marks it void or archived with a reason, **Then** its status changes without deleting bytes and an audit event records before/after/reason.
3. **Given** a new version supersedes an active version, **When** upload completes, **Then** the former version is SUPERSEDED and remains retrievable according to permission rules.
4. **Given** feature 013 calls `markApproved(versionId, actor)`, **When** preconditions pass, **Then** the version becomes approved and the action is audited without this feature selecting which version to approve.

---

### User Story 4 - Attach evidence to operational records (Priority: P2)

A staff member attaches a voice note, image, or file to a rejection, discrepancy, expense, audit event, or message. The attachment is generic, private, checksummed, and independently authorized by the owning feature.

**Why this priority**: Voice notes and images preserve context that text alone cannot capture during fast production work.

**Independent Test**: Attach each supported kind to representative entities, list metadata, download as an authorized actor, and verify unauthorized access and lifecycle operations are rejected.

**Acceptance Scenarios**:

1. **Given** an allowed target entity and stream, **When staff attaches a voice, image, or file, **Then** an Attachment and underlying immutable file metadata are created.
2. **Given** an Attachment, **When** the owning feature authorizes access, **Then** the bytes can be streamed and integrity-checked.
3. **Given** an Attachment, **When** a user attempts permanent deletion, **Then** the request is rejected; lifecycle must use archive/void/supersede.

### Edge Cases

- Upload interruption must leave no active FileVersion claiming bytes that were not completely stored.
- A repeated upload with identical bytes follows the approved deduplication policy but never replaces a version record.
- Unsupported MIME type, invalid filename, or file exceeding 5 GB is rejected before becoming visible as an active version.
- Version numbering remains monotonic per FileAsset under concurrent uploads.
- A file whose checksum does not match its stored SHA-256 is unavailable until repaired or archived by an authorized Admin.
- Categories are limited to Original, Design Versions, Review/Proof, Approved, Production, and Supporting.
- Approved and Production access rules apply independently of the physical storage path.
- A signed preview URL cannot be used for a download after expiry or by a different unauthorized context.
- Generic attachments must not assume every target has a Work Item relation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST represent bytes as a FileObject with storage key, byte size, SHA-256 checksum, MIME type, and immutable storage metadata.
- **FR-002**: System MUST represent a logical file on a Work Item as a FileAsset and each upload as a FileVersion containing monotonically increasing version number, original name, uploader, note, created time, status, and approved state.
- **FR-003**: System MUST represent generic links as Attachments with entity type, entity ID, file reference, original name, and kind `voice`, `image`, or `file`.
- **FR-004**: System MUST support exactly these Work Item categories: Original, Design Versions, Review/Proof, Approved, Production, and Supporting.
- **FR-005**: Every upload MUST create a new FileVersion; no prior bytes or version record may be overwritten.
- **FR-006**: The server MUST compute SHA-256 while receiving the stream and MUST persist the final checksum and byte size.
- **FR-007**: Upload processing MUST stream to storage and MUST support PSD, AI, TIFF, PDF, and other approved large print files from hundreds of MB through 5 GB maximum without loading the full file into process memory.
- **FR-008**: The local filesystem StorageAdapter MUST implement the 002 storage contract and store objects by opaque hash/ID-based paths, never customer names, Work Item names, or folders as business identifiers.
- **FR-009**: The system MUST provide `files.upload(tx, input)`, `files.listVersions(workItemId, category?)`, `files.markApproved(tx, versionId, actor)`, `files.getDownloadUrl(versionId, actor)`, `files.void(versionId, actor, reason)`, `files.archive(versionId, actor, reason)`, and `attachments.attach(tx, input)` with the contract-defined behavior.
- **FR-010**: Downloads MUST authenticate with `getActor`, authorize before access, verify SHA-256, and stream bytes through an application route using 64KB chunks with 30s per-chunk timeout and 5min total stream timeout.
- **FR-011**: The system MUST provide short-lived signed preview URLs using an expiring token; a URL MUST stop authorizing access after 5 minutes (300 seconds).
- **FR-012**: Production operators MUST download only Approved or Production files for Work Items in their department; department scope is configurable data (not hardcoded enum). Assigned designers MUST access files for assigned Work Items; Admin MUST access all files permitted by system policy.
- **FR-013**: The system MUST provide preview generation for image and PDF formats only; other formats show metadata and icon.
- **FR-014**: `<FilePanel workItemId categories={[...]}>` MUST list versions with actor, time, note, status, download action, upload-new-version action, and void/archive actions requiring a reason.
- **FR-015**: The system MUST support statuses ACTIVE, SUPERSEDED, VOID, and ARCHIVED; lifecycle operations MUST be audited and MUST never permanently delete bytes.
- **FR-016**: Feature 013 MUST be able to call `markApproved(versionId, actor)`; 050 MUST enforce authorization and audit but MUST NOT decide which version is approved.
- **FR-017**: The attachments contract MUST provide `attachments.attach(tx, input)` for voice, image, and file streams, with private storage and integrity metadata.
- **FR-018**: Every file lifecycle mutation and approval MUST emit an append-only audit event with actor, action, entity, before/after values, and reason where required.
- **FR-019**: All file and attachment entry points MUST authenticate and authorize server-side using feature 001 contracts and owning entity scope.
- **FR-020**: The system MUST reject incomplete, files exceeding 5 GB, unsupported, or checksum-invalid uploads without exposing an active version. Temporary objects MUST be cleaned up within 1 hour of upload failure via a background sweeper; database transaction MUST ensure temp object removal on rollback.
- **FR-021**: External share links are out of scope for V1; all file access MUST use authenticated application routes or short-lived authorized preview URLs, and permanent public URLs are prohibited.
- **FR-022**: The system MUST expose stable contracts for 011, 012, 013, 014, 015; future features when implemented.
- **FR-023**: Version numbering MUST remain monotonic under concurrent uploads using database unique constraint on (fileAssetId, versionNumber) with application-level retry: max 3 attempts, exponential backoff 100ms/200ms/400ms, timeout 5s per attempt.
- **FR-024**: Admin MUST be able to initiate checksum verification and repair via 091 backup; 091 MUST expose backup.restoreObject(storageKey, targetPath) and backup.verifyChecksum(storageKey) APIs; corrupted FileObject MUST be marked for re-upload with status CORRUPTED.
- **FR-025**: Audit events MUST follow 001 audit.record contract: actor, action, entity, entityId, timestamp, beforeValues, afterValues, reason.
- **FR-026**: V1 MUST NOT support resumable/chunked uploads; interrupted uploads MUST restart from beginning.
- **FR-027**: Upload interruption cleanup: temporary objects and partial metadata MUST be removed; no active FileVersion MUST be created for incomplete uploads.

### Out of Scope

- Choosing which version is approved; feature 013 owns that decision.
- S3, MinIO, Supabase, or other remote storage backends.
- File backup and disaster recovery; feature 091 owns it.
- Browser editing, virus scanning, OCR, and permanent byte deletion.
- Customer/order folder naming as an identifier.

### Key Entities

- **FileObject**: Immutable stored bytes and integrity metadata.
- **FileAsset**: Logical file attached to a Work Item and category.
- **FileVersion**: One immutable upload/version of a FileAsset with lifecycle and approval metadata.
- **Attachment**: Generic link between a FileObject/FileVersion and an operational entity.
- **StorageAdapter**: Existing 002 abstraction for putting, reading, checking, and streaming opaque objects.
- **SignedPreviewGrant**: Short-lived authorization token for an authorized preview.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uploading `banner.pdf` twice creates v1 SUPERSEDED and v2 ACTIVE, with both versions downloadable by authorized users and neither byte object overwritten.
- **SC-002**: 100% of cross-department production download attempts are rejected with 403 and disclose zero file bytes.
- **SC-003**: 100% of signed preview URLs stop authorizing access after their five-minute lifetime.
- **SC-004**: A 2 GB upload completes without the Node process exceeding 200 MB additional memory during transfer.
- **SC-005**: 100% of tampered stored objects are detected by checksum verification before download or preview.
- **SC-006**: 100% of void, archive, supersede, and approval actions produce append-only audit events with required actor and before/after data.
- **SC-007**: Authorized staff can locate a requested version and initiate an allowed download from FilePanel in under 10 seconds in at least 90% of observed trials.
- **SC-008**: Voice, image, and file attachments can be created and retrieved through one generic contract for all five target entity types without feature-specific storage code.

## Assumptions

- The 002 `StorageAdapter` contract, 001 `getActor`/`authorize`/`audit.record`, and Work Item model are available and stable.
- V1 enforces a 5 GB maximum file size. The configured initial MIME allowlist includes PSD, AI, TIFF, PDF, common image formats, and common audio formats.
- Uploads arrive directly from clients on the local LAN server; V1 streams them but does not require resumable/chunked transfer, so interrupted uploads are discarded and retried from the beginning.
- Internal file links are included in V1, but every link resolves through the authenticated application and existing authorization rules; they are not public external share links.
- Identical bytes MUST be deduplicated at the FileObject layer by SHA-256 while each logical upload still receives its own FileVersion record.
- V1 previews are generated only for image and PDF formats; other formats show metadata and an icon only.
- The local filesystem root is private and configured outside source control; object paths use opaque IDs/hash prefixes.
- Admin can access all file records; other access is constrained by Work Item assignment/department and category/status.
- All timestamps are stored in UTC and rendered in the shop timezone.
- Existing Work Items without FileAssets are migrated on first file access: a synthetic FileAsset per category is created with logicalName='Migrated', and existing network folder paths are recorded as legacy references in FileAsset.notes.

## Clarifications

### Session 2026-09-23

- Q: Should external share links be included in V1, or deferred to a later feature? → A: Defer public external share links; include authenticated internal LAN application links in V1.
- Q: Should large uploads support resumable/chunked transfer in V1, or restart from the beginning after interruption? → A: No resumable/chunked transfer; uploads occur directly over the local LAN and restart after interruption.
- Q: What maximum file size and initial MIME allowlist should V1 enforce? → A: 5 GB maximum; PSD, AI, TIFF, PDF, common images, and common audio.
- Q: Should identical uploaded bytes share one stored FileObject while each upload keeps its own FileVersion record? → A: Deduplicate identical bytes by SHA-256 at FileObject level while preserving every FileVersion.
- Q: Should V1 generate previews for AI, PSD, and CDR files, or show metadata and an icon only? → A: Generate previews only for images and PDF; show metadata and an icon for AI, PSD, and CDR.

### Pending decisions for `/speckit-clarify`

- External share links are deferred beyond V1.
- Whether resumable/chunked uploads are required for large Wi-Fi uploads.
- Whether the proposed 5 GB maximum and configured MIME allowlist are acceptable.
- Whether checksum deduplication should reuse FileObject bytes while preserving every FileVersion.
- Whether AI/PSD/CDR previews remain metadata-only in V1.
- **FR-028**: System MUST migrate legacy Work Items on first file access by creating synthetic FileAssets per category with logicalName='Migrated' and recording legacy network paths.
