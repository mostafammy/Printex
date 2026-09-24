# Data Model: Private File Storage & Versioning

## FileObject

Immutable physical bytes, deduplicated by checksum.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Immutable. |
| `storageKey` | text | Opaque hash/ID-based key; never customer/folder naming. Unique. |
| `sizeBytes` | integer | Required, 0–5 GB inclusive. |
| `sha256` | text | Required 64-hex checksum; unique for deduplication. |
| `mimeType` | text | Required; validated against configured allowlist. |
| `createdAt` | UTC timestamp | Immutable. |

## FileAsset

Logical file attached to one Work Item and category.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Immutable. |
| `workItemId` | ID | Required Work Item relation. |
| `category` | category | Exactly Original, Design Versions, Review/Proof, Approved, Production, Supporting. |
| `logicalName` | text | Display/grouping name; never storage identity. |
| `createdAt` / `updatedAt` | timestamp | UTC. |

One Work Item may have many FileAssets across categories. A logical asset has monotonically increasing versions.

## FileVersion

Immutable upload metadata pointing to a FileObject.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Immutable. |
| `fileAssetId` | ID | Required relation. |
| `fileObjectId` | ID | Required relation; may be shared by identical bytes. |
| `versionNumber` | integer | Unique per FileAsset, starts at 1, monotonic under concurrency. |
| `originalName` | text | Display filename; validated, no path traversal. |
| `uploadedById` | ID | Required actor. |
| `note` | text nullable | Optional upload note. |
| `status` | lifecycle | ACTIVE, SUPERSEDED, VOID, ARCHIVED. |
| `approved` | boolean | Set only through `markApproved`; approval owner is 013. |
| `createdAt` | UTC timestamp | Immutable. |

Uploading a new version marks the prior active version SUPERSEDED without deleting its FileObject.

## Attachment

Generic link to an operational entity.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Immutable. |
| `fileObjectId` | ID | Required. |
| `entityType` | text | Rejection, discrepancy, expense, audit event, message, or future configured target. |
| `entityId` | ID/text | Target identifier; polymorphic and authorized by owning feature. |
| `originalName` | text | Display name. |
| `kind` | enum/data | voice, image, file. |
| `createdById` | ID | Actor. |
| `createdAt` | timestamp | UTC. |
| `status` | lifecycle | ACTIVE, VOID, ARCHIVED. |

## SignedPreviewGrant

Short-lived authorization data, preferably stateless and HMAC-signed.

- `versionId`
- `actorId` or authorized scope binding
- `purpose = preview`
- `expiresAt`, 5 minutes (300 seconds)
- signature/key version

Expired, malformed, or scope-mismatched grants are rejected.

## Config

Runtime configuration singleton loaded from `config/050-files.yaml` at startup.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Fixed value `files-config` (singleton). |
| `mimeAllowlist` | JSON | Required array of MIME type patterns; validated on write. |
| `maxFileSizeBytes` | integer | Required, 1–10 GB inclusive. |
| `departments` | JSON | Required array of `{ name: string, code: string }`; managed by Admin UI. |
| `previewExpirySeconds` | integer | Required, 60–3600. |
| `updatedAt` | UTC timestamp | Immutable. |
| `updatedById` | ID | Admin actor who last updated. |

## AuditEvent

Append-only audit trail for all file lifecycle mutations and approvals.

| Field | Type | Rules |
|---|---|---|
| `id` | ID | Immutable. |
| `actorId` | ID | Required actor. |
| `action` | text | Enum: CREATE, UPDATE, STATUS_CHANGE, APPROVE, VOID, ARCHIVE, SUPERSEDE. |
| `entity` | text | FileObject, FileAsset, FileVersion, Attachment. |
| `entityId` | ID | Required. |
| `beforeValues` | JSON | Nullable. |
| `afterValues` | JSON | Nullable. |
| `reason` | text | Required for VOID, ARCHIVE, SUPERSEDE, APPROVE. |
| `createdAt` | UTC timestamp | Immutable. |

Follows 001 `audit.record` contract.

## Invariants

1. No FileVersion or Attachment permanently deletes bytes in V1.
2. Every published FileVersion points to a complete FileObject whose checksum matches on read.
3. FileObject SHA-256 deduplication never removes a FileVersion record.
4. Storage keys contain no customer name, Work Item name, or user-controlled path.
5. All lifecycle and approval changes are append-only audited with before/after and required reason.
6. Production access requires both department scope and Approved/Production category/status; department scope is configurable data (not hardcoded enum).
7. Designer access requires assignment to the Work Item; Admin access is policy-authorized globally.
8. A FileVersion cannot become ACTIVE until streaming, checksum, size, and metadata validation complete.
9. Version numbering remains monotonic under concurrent uploads using database unique constraint on (fileAssetId, versionNumber) with application-level retry.
10. Attachment polymorphic links (entityType + entityId) enforced by application, not DB foreign keys.
