"use client";

import { useState } from "react";
import { FilePanel, type FileVersionItem } from "@/components/files/file-panel";

const MOCK_VERSIONS: FileVersionItem[] = [
  {
    id: "v1",
    versionNumber: 1,
    originalName: "banner-original.pdf",
    uploadedBy: { name: "Ahmed" },
    note: "Initial design",
    status: "SUPERSEDED",
    approved: false,
    createdAt: new Date("2026-09-20"),
    fileAsset: { category: "ORIGINAL" },
    fileObject: {
      id: "fo1",
      sizeBytes: 2_500_000,
      mimeType: "application/pdf",
      sha256: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    },
  },
  {
    id: "v2",
    versionNumber: 2,
    originalName: "banner-v2.pdf",
    uploadedBy: { name: "Sara" },
    note: "Updated colors per client feedback",
    status: "ACTIVE",
    approved: false,
    createdAt: new Date("2026-09-22"),
    fileAsset: { category: "DESIGN_VERSIONS" },
    fileObject: {
      id: "fo2",
      sizeBytes: 3_100_000,
      mimeType: "application/pdf",
      sha256: "def789abc012def789abc012def789abc012def789abc012def789abc012def7",
    },
  },
  {
    id: "v3",
    versionNumber: 3,
    originalName: "design-final.png",
    uploadedBy: { name: "Ahmed" },
    note: null,
    status: "ACTIVE",
    approved: true,
    createdAt: new Date("2026-09-23"),
    fileAsset: { category: "APPROVED" },
    fileObject: {
      id: "fo3",
      sizeBytes: 5_200_000,
      mimeType: "image/png",
      sha256: "123abc456def123abc456def123abc456def123abc456def123abc456def123a",
    },
  },
  {
    id: "v4",
    versionNumber: 1,
    originalName: "proof-check.pdf",
    uploadedBy: { name: "Omar" },
    note: "Review proof for print",
    status: "VOID",
    approved: false,
    createdAt: new Date("2026-09-21"),
    fileAsset: { category: "REVIEW_PROOF" },
    fileObject: {
      id: "fo4",
      sizeBytes: 1_800_000,
      mimeType: "application/pdf",
      sha256: "456def789abc456def789abc456def789abc456def789abc456def789abc456d",
    },
  },
];

export default function FilesTestPage() {
  const [versions, setVersions] = useState<FileVersionItem[]>(MOCK_VERSIONS);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) =>
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  return (
    <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Files Test Page (temp)</h1>
      <p className="text-muted-foreground text-sm">
        Temporary page to test FilePanel. Will be removed.
      </p>

      <FilePanel
        workItemId="test-workitem-1"
        fileVersions={versions}
        onDownload={(id) => addLog(`Download: ${id}`)}
        onUpload={(cat) => addLog(`Upload to: ${cat}`)}
        onVoid={(id, reason) => {
          addLog(`Void: ${id} — "${reason}"`);
          setVersions((prev) =>
            prev.map((v) => (v.id === id ? { ...v, status: "VOID" } : v))
          );
        }}
        onArchive={(id, reason) => {
          addLog(`Archive: ${id} — "${reason}"`);
          setVersions((prev) =>
            prev.map((v) => (v.id === id ? { ...v, status: "ARCHIVED" } : v))
          );
        }}
        onApprove={(id) => {
          addLog(`Approve: ${id}`);
          setVersions((prev) =>
            prev.map((v) => (v.id === id ? { ...v, approved: true } : v))
          );
        }}
      />

      {log.length > 0 && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <h2 className="font-semibold text-sm mb-2">Action Log</h2>
          <ul className="text-xs font-mono space-y-1">
            {log.map((entry, i) => (
              <li key={i}>{entry}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
