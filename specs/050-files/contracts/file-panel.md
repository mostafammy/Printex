# `<FilePanel>` Contract

```ts
type FilePanelProps = {
  workItemId: string;
  categories?: Array<"Original" | "Design Versions" | "Review/Proof" | "Approved" | "Production" | "Supporting">;
};
```

Behavior:

- Arabic-first RTL panel; keyboard-accessible category tabs and version list.
- Shows version number, filename, uploader, timestamp, note, status, size, MIME, checksum summary, and approved state.
- Supports authorized download, upload-new-version, void/archive with required reason.
- Does not choose approval; it may display approval and expose the 013-owned approval action boundary.
- Shows image/PDF previews; AI/PSD/CDR show metadata and icon only.
- Loading, empty, validation, checksum, forbidden, and server-error states are explicit.
- Internal links resolve through authenticated application routes; no public external sharing in V1.
