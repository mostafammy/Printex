// StorageAdapter port — contracts/storage.md, plan.md §5.2, §5.3.
//
// `key` is an opaque string chosen by the caller; this interface does not
// define a key scheme (folder-per-order, hash-based, etc.) — that decision
// belongs to 050 (contracts/storage.md), per constitution IV ("Business
// logic MUST NOT depend on folder paths or file names as identifiers").
//
// `put` on a key that already exists is NOT defined as an overwrite by this
// interface. Implementations MUST refuse to overwrite an existing key rather
// than silently updating it in place (constitution IV: "existing versions...
// MUST NEVER be overwritten in place").
//
// `get` on a missing key rejects; `exists` never throws for a missing key
// (returns `false`).
//
// This is a Port — implementations under `src/server/core/storage/**` are
// exempt from the "core must not throw" ESLint rule (eslint.config.js rule
// (c)) precisely because they may throw/reject; callers elsewhere in `core`
// catch and convert those rejections to `Result<T, DomainError>` at the call
// site, not here.

export interface StorageAdapter {
  put(
    key: string,
    body: NodeJS.ReadableStream,
  ): Promise<{ size: number; sha256: string }>;
  get(key: string): Promise<NodeJS.ReadableStream>;
  exists(key: string): Promise<boolean>;
}
