# Contract: Storage Adapter

Owner: 002 (this feature, interface + local-disk dev stub only). Real implementation: 050 (file versioning/download/preview).

## Interface

```ts
interface StorageAdapter {
  put(key: string, body: Readable): Promise<{ size: number; sha256: string }>;
  get(key: string): Promise<Readable>;
  exists(key: string): Promise<boolean>;
}
```

- `key` is an opaque string chosen by the caller. This interface does not define a key scheme (folder-per-order, hash-based, etc.) — that decision belongs to 050, per constitution IV ("Business logic MUST NOT depend on folder paths or file names as identifiers").
- `put` on a key that already exists is **not** defined as an overwrite by this interface. 050's implementation MUST treat every version as a new key (constitution IV: "existing versions... MUST NEVER be overwritten in place"); this feature's local-disk stub also refuses to overwrite an existing key and throws instead, so accidental misuse fails loudly in development.
- `get` on a missing key rejects; `exists` never throws for a missing key (returns `false`).
- Binary content only — version metadata (uploader, note, version number) lives in the database, owned by 050, not by this interface.

## Local-disk stub (this feature)

- Root directory from `env.STORAGE_ROOT` (new T3 `env.js` entry, validated at startup).
- Development/CI only — explicitly out of scope for production use (spec Assumptions).
- Implements the interface with no additional behavior: no versioning, no checksum caching beyond the one computed on `put`, no access control (private-by-default file *serving* is 050's job, not this stub's).

## 050's local-disk implementation (extends stub)

- Root directory from `env.STORAGE_ROOT` (validated at startup).
- Production-ready local filesystem adapter.
- Keys are opaque hash/ID strings chosen by 050; stored at `${root}/${key[0..1]}/${key[2..3]}/${key}`; **never uses customer/workitem/user names in paths**.
- `put(key, body)` streams to temporary file, computes SHA-256 and size, then atomically moves to final key path. **Throws if key already exists (no overwrite).**
- `get(key)` opens file stream, **computes streaming SHA-256 and verifies against stored checksum before yielding bytes**; throws on mismatch.
- `exists(key)` checks filesystem.

## Rules for consumers

- Never read/write the filesystem directly for anything that is or will become a stored file — always go through an injected `StorageAdapter`, so swapping the local-disk stub for 050's real backend requires no caller changes.