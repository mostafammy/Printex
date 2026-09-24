# Research: Private File Storage & Versioning

## Decision: Keep file bytes behind the existing 002 StorageAdapter and store immutable metadata in PostgreSQL

**Rationale**: The application owns version history, permissions, checksums, and lifecycle state. The adapter isolates local filesystem paths from domain logic and leaves S3/MinIO-compatible backends possible later.

**Alternatives considered**: Direct folder access was rejected because folder names are not identifiers and would violate Constitution IV. Remote storage is out of scope for V1.

## Decision: Stream uploads through a temporary object, hash during receipt, then atomically publish by opaque object key

**Rationale**: Local LAN uploads can be hundreds of MB to 5 GB. Streaming prevents whole-file memory usage and allows incomplete transfers to be discarded before a FileVersion becomes active. Object paths use hash/ID prefixes, never customer or Work Item names.

**Alternatives considered**: Buffering in memory was rejected by the 2 GB/200 MB memory criterion. Publishing directly to the final path was rejected because interrupted uploads could appear complete.

## Decision: Deduplicate FileObject bytes by SHA-256 while preserving each FileVersion

**Rationale**: Repeated uploads save disk space while retaining independent version history, notes, actors, and lifecycle records. FileObject reference counting prevents premature physical cleanup; permanent deletion remains out of scope.

**Alternatives considered**: Storing duplicate bytes was simpler but wastes local disk. Collapsing duplicate FileVersions would destroy audit/history semantics.

## Decision: Use authenticated internal application links; defer public external shares

**Rationale**: The LAN server is the trusted operational file hub. Internal links remain subject to `getActor`, authorization, checksum verification, and audit policy. Public links add an unnecessary exposure surface in V1.

**Alternatives considered**: Expiring public links are deferred beyond V1; permanent public URLs are prohibited.

## Decision: Do not implement resumable uploads in V1

**Rationale**: Clients upload directly over the local LAN. Streaming plus temporary-file cleanup satisfies the stated reliability boundary; interrupted transfers restart without introducing chunk-session state.

**Alternatives considered**: Chunk manifests and resume tokens add complexity and cleanup cases without a V1 requirement for WAN/mobile uploads.

## Decision: Enforce a 5 GB limit and configured MIME allowlist

**Rationale**: The limit covers large print files while bounding storage and operational risk. Initial configured types include PSD, AI, TIFF, PDF, common images, and common audio.

**Alternatives considered**: An unrestricted allowlist was rejected because it weakens validation and preview/security behavior.

## Decision: Generate previews only for images and PDF

**Rationale**: These formats have a predictable V1 preview path. AI/PSD/CDR show icon/metadata, avoiding heavyweight converters and untrusted parser dependencies.

**Alternatives considered**: Native design-file previews are deferred beyond V1.

## Decision: Enforce access at the application boundary before streaming

**Rationale**: Production department scope, designer assignment, category/status, Admin access, signed preview expiry, and checksum verification must remain server authority. Storage paths never grant access.

**Alternatives considered**: Direct static file serving or path-based authorization was rejected by Constitution IV/V.
