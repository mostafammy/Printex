# Files Feature Validation Guide

## Prerequisites

- Local PostgreSQL and existing 001/002 schema/contracts.
- Private local storage root configured outside source control.
- Dependencies installed with `pnpm install`.
- Authenticated test actors: assigned designer, same-department production operator, other-department operator, Admin.

## Checks

```bash
pnpm check
pnpm test
```

Expected: static checks and file unit/contract/integration tests pass.

## Validation scenarios

1. **Versioning**
   - Upload `banner.pdf` twice to one Work Item/category.
   - Expected: v1 SUPERSEDED, v2 ACTIVE; both metadata records and bytes remain available to authorized users.

2. **Streaming and limits**
   - Upload a representative large file through the LAN endpoint.
   - Expected: process memory remains below 200 MB additional memory for a 2 GB transfer.
   - Test 5 GB boundary, over-limit file, unsupported MIME, and interrupted upload.
   - Expected: valid boundary accepted; invalid/incomplete uploads create no active version.

3. **Deduplication**
   - Upload identical bytes under separate logical uploads.
   - Expected: one FileObject reused by SHA-256; separate FileVersion records retain independent actor/note/history.

4. **Permissions**
   - Download as assigned designer, same-department production operator, other-department operator, and Admin.
   - Expected: designer assignment access; production access only to Approved/Production in own department; other department 403; Admin allowed.

5. **Integrity**
   - Modify an object outside the application and request download/preview.
   - Expected: SHA-256 mismatch detected and bytes not returned.

6. **Signed/internal links**
   - Request a preview URL as an authorized actor, use it before expiry, then after approximately five minutes.
   - Expected: first request works; expired request fails. Internal application links still require authentication/authorization.

7. **Lifecycle and audit**
   - Void/archive/supersede a version with and without a reason.
   - Expected: missing reason rejected; valid action preserves bytes and writes audit before/after/reason.

8. **Attachments and previews**
   - Attach voice, image, and file streams to rejection, discrepancy, expense, audit, and message entities.
   - Expected: generic Attachment records; authorized retrieval; unauthorized denial; image/PDF previews; AI/PSD/CDR metadata/icon.

## Contract references

- [contracts/files.md](contracts/files.md)
- [contracts/storage.md](contracts/storage.md)
- [contracts/file-panel.md](contracts/file-panel.md)
- [data-model.md](data-model.md)
