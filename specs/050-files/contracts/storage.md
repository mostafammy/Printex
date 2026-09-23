# StorageAdapter Integration Contract

050 consumes the frozen 002 `StorageAdapter`; it does not redefine it.

Required capabilities for file implementation:

- Put a streamed object under an opaque storage key.
- Open/read an object as a stream.
- Check existence.
- Return size/metadata as needed.
- Keep application metadata independent from physical paths.

The local filesystem adapter stores objects below a configured private root using hash/ID prefixes, for example `ab/cd/<opaque-id>`. User input is never used as a path component. Temporary upload files are removed after success or failure.

The adapter must not decide permissions, version status, approval, or audit history.
