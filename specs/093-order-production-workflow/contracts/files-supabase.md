# Contract: Files on Supabase (050-compatible)

Surface unchanged — only the StorageAdapter backend is new:

```ts
files.upload(tx, { workItemId, category, stream, fileName, mimeType, note, actor }): FileVersion
files.listVersions(workItemId, category?): FileVersion[]
files.markApproved(tx, versionId, actor): void        // 013/head-designer only
files.getDownloadUrl(versionId, actor): { url: string; expiresIn: 300 }
files.void / files.archive(tx, versionId, actor, reason): void
```

Backend: `SupabaseStorageAdapter implements StorageAdapter` — private bucket, opaque keys, server-side SHA-256 while streaming, service-role key server-only, RLS deny-all for anon, signed URLs ≤300 s, temp-object cleanup ≤1 h on failure, 5 GB max, allowlist enforced before persist. DesignVersion metadata rows still reference `storageKey`; bytes never addressed by filename.

Gates: designer completion requires ≥1 ACTIVE version owned by the work item; accountant approval fails if the referenced version is VOID/ARCHIVED/CORRUPTED; replacement creates a new version (monotonic unique constraint + retry, per 050 FR-023); every mutation emits FileAuditEvent + pipeline audit in the same tx.
