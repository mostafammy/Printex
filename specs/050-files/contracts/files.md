# Files Contract

All operations are server-authoritative, authenticated, authorized, schema-validated, and audit-aware. File bytes are streamed; APIs never require whole-file buffering.

## `files.upload(tx, input)`

```ts
type UploadInput = {
  workItemId: string;
  category: "Original" | "Design Versions" | "Review/Proof" | "Approved" | "Production" | "Supporting";
  stream: ReadableStream;
  fileName: string;
  note?: string;
  actor: Actor;
};
```

Creates a new FileAsset if needed and a new FileVersion. Computes SHA-256 and size while streaming to a temporary local object. Publishes only after validation. Deduplicates identical FileObject bytes but never collapses FileVersion records. Previous ACTIVE version becomes SUPERSEDED.

Limits: 5 GB; configured MIME allowlist; no resumable/chunked upload in V1; interrupted transfer is discarded.

## `files.listVersions(workItemId, category?)`

Returns authorized FileVersion metadata ordered by category, version descending, including actor, note, status, approval, checksum, size, MIME, and created time. Does not expose storage keys or unauthenticated bytes.

## `files.markApproved(tx, versionId, actor)`

Called by feature 013. Validates actor and version/work-item scope, sets approved state, emits audit event, and does not choose a version on its own.

## `files.getDownloadUrl(versionId, actor)`

Returns an authenticated internal LAN application URL or short-lived preview URL. The download route re-checks actor authorization, verifies checksum, then streams bytes. No public external share URL exists in V1.

## `files.void(tx, versionId, actor, reason)`

Require an explicit reason. Update lifecycle status to VOID, preserve metadata and bytes, and audit before/after/reason. Permanent deletion is unavailable.

## `files.archive(tx, versionId, actor, reason)`

Require an explicit reason. Update lifecycle status to ARCHIVED, preserve metadata and bytes, and audit before/after/reason. Permanent deletion is unavailable.

## Permission matrix

- Admin: all authorized files.
- Assigned designer: files for assigned Work Items.
- Production operator: only Approved/Production category files for Work Items in their department; department scope is configurable data (not hardcoded enum).
- Other users: denied unless owning feature grants an explicit scope.

## `attachments.attach(tx, input)`

```ts
type AttachmentInput = {
  entityType: string;
  entityId: string;
  stream: ReadableStream;
  fileName: string;
  kind: "voice" | "image" | "file";
};
```

Creates a generic Attachment and immutable FileObject metadata. Entity ownership authorization remains with the consuming feature.
