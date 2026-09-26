"use client";

import React, { useState, useMemo, useRef } from "react";
import { FilePreview, isPreviewable } from "./file-preview";

export interface FileVersionItem {
  id: string;
  versionNumber: number;
  originalName: string;
  uploadedById?: string;
  uploadedBy?: { name: string };
  note?: string | null;
  status: string;
  approved: boolean;
  createdAt: string | Date;
  category?: string;
  fileAsset?: { category: string };
  fileObject?: {
    id: string;
    sizeBytes: number;
    mimeType: string;
    sha256: string;
    storageKey?: string;
  } | null;
}

export interface FilePanelProps {
  workItemId: string;
  categories?: string[];
  fileVersions?: FileVersionItem[];
  workItem?: any;
  loading?: boolean;
  error?: string;
  forbidden?: boolean;
  onDownload?: (versionId: string) => void;
  onUpload?: (category: string) => void;
  onVoid?: (versionId: string, reason: string) => void;
  onArchive?: (versionId: string, reason: string) => void;
  onApprove?: (versionId: string) => void;
  currentUser?: {
    id: string;
    permissions?: Set<string> | string[];
    departmentIds?: string[];
  };
}

const DEFAULT_CATEGORIES = [
  "ORIGINAL",
  "DESIGN_VERSIONS",
  "REVIEW_PROOF",
  "APPROVED",
  "PRODUCTION",
  "SUPPORTING",
];

function formatFileSize(bytes?: number | bigint): string {
  if (bytes === undefined || bytes === null) return "0 B";
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n >= 1024 * 1024 * 1024) return `${Math.round(n / (1024 * 1024 * 1024))} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function formatDate(dateInput?: string | Date): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatChecksum(sha256?: string): string {
  if (!sha256) return "";
  return `${sha256.slice(0, 8)}...`;
}

export const FilePanel: React.FC<FilePanelProps> = ({
  workItemId: _workItemId,
  categories = DEFAULT_CATEGORIES,
  fileVersions = [],
  workItem: _workItem,
  loading = false,
  error,
  forbidden = false,
  onDownload,
  onUpload,
  onVoid,
  onArchive,
  onApprove,
  currentUser: _currentUser,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("DESIGN_VERSIONS");
  const [modalAction, setModalAction] = useState<"VOID" | "ARCHIVE" | null>(null);
  const [targetVersionId, setTargetVersionId] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Memoize filtered versions based on selected tab — use only authoritative category
  const filteredVersions = useMemo(() => {
    if (fileVersions.length === 0) return [];

    return fileVersions.filter((v) => {
      const cat = v.fileAsset?.category ?? v.category;
      return !cat || cat === selectedCategory;
    });
  }, [fileVersions, selectedCategory]);

  const handleTabKeyDown = (index: number, e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowLeft") {
      // In RTL, ArrowLeft moves to next tab
      e.preventDefault();
      const nextIndex = (index + 1) % categories.length;
      tabRefs.current[nextIndex]?.focus();
      setSelectedCategory(categories[nextIndex]!);
    } else if (e.key === "ArrowRight") {
      // In RTL, ArrowRight moves to previous tab
      e.preventDefault();
      const prevIndex = (index - 1 + categories.length) % categories.length;
      tabRefs.current[prevIndex]?.focus();
      setSelectedCategory(categories[prevIndex]!);
    } else if (e.key === "Home") {
      e.preventDefault();
      tabRefs.current[0]?.focus();
      setSelectedCategory(categories[0]!);
    } else if (e.key === "End") {
      e.preventDefault();
      const lastIndex = categories.length - 1;
      tabRefs.current[lastIndex]?.focus();
      setSelectedCategory(categories[lastIndex]!);
    }
  };

  const openActionModal = (action: "VOID" | "ARCHIVE", versionId: string) => {
    setModalAction(action);
    setTargetVersionId(versionId);
    setActionReason("");
    setReasonError("");
  };

  const confirmActionModal = () => {
    if (!actionReason.trim()) {
      setReasonError("Reason is required");
      return;
    }

    if (modalAction === "VOID" && targetVersionId && onVoid) {
      onVoid(targetVersionId, actionReason.trim());
    } else if (modalAction === "ARCHIVE" && targetVersionId && onArchive) {
      onArchive(targetVersionId, actionReason.trim());
    }

    setModalAction(null);
    setTargetVersionId(null);
    setActionReason("");
    setReasonError("");
  };

  if (forbidden) {
    return (
      <div data-testid="file-panel" dir="rtl" className="p-4 border rounded-lg bg-destructive/10 text-destructive">
        <div role="alert" className="font-semibold text-center">
          Access denied. You do not have permission to view these files.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div data-testid="file-panel" dir="rtl" className="p-6 border rounded-lg flex items-center justify-center">
        <div role="status" className="text-muted-foreground font-medium animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="file-panel" dir="rtl" className="p-4 border rounded-lg bg-destructive/10 text-destructive">
        <div role="alert" className="font-medium text-center">
          {error}
        </div>
      </div>
    );
  }

  const pdfVersion = filteredVersions.find((v) => v.fileObject?.mimeType === "application/pdf" || v.originalName.toLowerCase().endsWith(".pdf"));
  const nonPreviewVersion = filteredVersions.find((v) => !isPreviewable(v.fileObject?.mimeType, v.originalName));

  return (
    <div data-testid="file-panel" dir="rtl" className="w-full border rounded-lg bg-card text-card-foreground p-4 space-y-4">
      {/* Header and Upload button */}
      <div className="flex items-center justify-between gap-4 border-b pb-3">
        <h2 className="text-lg font-bold">الملفات والإصدارات (Files & Versions)</h2>
        <button
          type="button"
          onClick={() => onUpload?.(selectedCategory)}
          className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 transition text-sm"
          aria-label="Upload new version"
        >
          Upload new version
        </button>
      </div>

      {/* Category Tabs */}
      <div role="tablist" className="flex flex-wrap gap-2 border-b pb-2">
        {categories.map((cat, idx) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelectedCategory(cat)}
              onKeyDown={(e) => handleTabKeyDown(idx, e)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Version Table / Empty state */}
      {filteredVersions.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground font-medium">
          No versions found
        </div>
      ) : (
        <div className="space-y-4">
          <div ref={listContainerRef} className="overflow-x-auto">
            <table className="w-full text-sm text-start border-collapse">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground font-semibold text-xs">
                  <th className="p-2 text-start">Version</th>
                  <th className="p-2 text-start">Filename</th>
                  <th className="p-2 text-start">Uploader</th>
                  <th className="p-2 text-start">Timestamp</th>
                  <th className="p-2 text-start">Note</th>
                  <th className="p-2 text-start">Status</th>
                  <th className="p-2 text-start">Size</th>
                  <th className="p-2 text-start">MIME</th>
                  <th className="p-2 text-start">Checksum</th>
                  <th className="p-2 text-start">Approved</th>
                  <th className="p-2 text-start">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVersions.map((v) => {
                  const uploaderName = v.uploadedBy?.name ?? v.uploadedById ?? "System";
                  const sizeText = formatFileSize(v.fileObject?.sizeBytes);
                  const rawMime = v.fileObject?.mimeType ?? "application/octet-stream";
                  const checksumText = formatChecksum(v.fileObject?.sha256);
                  const approvedText = v.approved ? "Yes" : "No";

                  return (
                    <tr key={v.id} className="border-b hover:bg-muted/10 transition">
                      <td className="p-2 font-mono font-medium">{v.versionNumber}</td>
                      <td className="p-2 font-medium">{v.originalName}</td>
                      <td className="p-2">{uploaderName}</td>
                      <td className="p-2 text-muted-foreground whitespace-nowrap">
                        {formatDate(v.createdAt)}
                      </td>
                      <td className="p-2 text-muted-foreground">{v.note || "-"}</td>
                      <td className="p-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            v.status === "ACTIVE"
                              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                              : v.status === "SUPERSEDED"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-xs">{sizeText}</td>
                      <td className="p-2 font-mono text-xs max-w-[150px] truncate" title={rawMime}>
                        {rawMime}
                      </td>
                      <td className="p-2 font-mono text-xs">{checksumText}</td>
                      <td className="p-2 font-medium">{approvedText}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onDownload?.(v.id)}
                            className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded hover:bg-secondary/80"
                            aria-label={`Download v${v.versionNumber}`}
                          >
                            Download v{v.versionNumber}
                          </button>
                          {onApprove && (
                            <button
                              type="button"
                              onClick={() => onApprove(v.id)}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                              aria-label={`Approve v${v.versionNumber}`}
                            >
                              Approve v{v.versionNumber}
                            </button>
                          )}
                          {!v.approved && (
                            <button
                              type="button"
                              onClick={() => openActionModal("VOID", v.id)}
                              className="px-2 py-1 bg-destructive/80 text-destructive-foreground text-xs rounded hover:bg-destructive"
                              aria-label={`Void v${v.versionNumber}`}
                            >
                              Void v{v.versionNumber}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openActionModal("ARCHIVE", v.id)}
                            className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded hover:bg-muted/80"
                            aria-label={`Archive v${v.versionNumber}`}
                          >
                            Archive v{v.versionNumber}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Previews section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {pdfVersion && (
              <FilePreview
                originalName={pdfVersion.originalName}
                mimeType={pdfVersion.fileObject?.mimeType}
                sizeBytes={pdfVersion.fileObject?.sizeBytes}
              />
            )}
            {nonPreviewVersion && (
              <FilePreview
                originalName={nonPreviewVersion.originalName}
                mimeType={nonPreviewVersion.fileObject?.mimeType}
              />
            )}
          </div>
        </div>
      )}

      {/* Void / Archive Reason Modal Dialog */}
      {modalAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <div className="bg-card text-card-foreground border rounded-lg p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 id="modal-title" className="text-lg font-bold">
              {modalAction === "VOID" ? "Void File Version" : "Archive File Version"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Please provide a reason for this lifecycle action. This action will be audited.
            </p>
            <div className="space-y-1">
              <label htmlFor="reason-input" className="block text-sm font-medium">
                Reason
              </label>
              <textarea
                id="reason-input"
                aria-label="Reason"
                rows={3}
                value={actionReason}
                onChange={(e) => {
                  setActionReason(e.target.value);
                  if (reasonError) setReasonError("");
                }}
                placeholder="Enter required reason..."
                className="w-full p-2 border rounded text-sm bg-background"
              />
              {reasonError && (
                <p className="text-xs text-destructive font-medium">{reasonError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalAction(null)}
                className="px-4 py-2 border rounded text-sm hover:bg-muted font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmActionModal}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded text-sm font-medium hover:bg-destructive/90"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilePanel;
