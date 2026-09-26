"use client";

import React from "react";
import { FileText, Image as ImageIcon, FileCode } from "lucide-react";

export interface FilePreviewProps {
  mimeType?: string;
  originalName: string;
  previewUrl?: string;
  sizeBytes?: number;
}

function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "";
  if (bytes >= 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function isPreviewable(mimeType?: string, fileName?: string): boolean {
  if (mimeType === "application/pdf") return true;
  if (mimeType?.startsWith("image/") && !mimeType.includes("adobe") && !mimeType.includes("photoshop")) {
    return true;
  }
  const ext = fileName?.toLowerCase().split(".").pop();
  if (ext === "pdf" || ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp" || ext === "svg") {
    return true;
  }
  return false;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  mimeType,
  originalName,
  previewUrl,
  sizeBytes,
}) => {
  const isPdf = mimeType === "application/pdf" || originalName.toLowerCase().endsWith(".pdf");
  const isImage = (mimeType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(originalName)) &&
    !mimeType?.includes("adobe") && !mimeType?.includes("photoshop") && !/\.(ai|psd|cdr)$/i.test(originalName);

  if (isPdf) {
    return (
      <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-muted/20 text-center gap-2">
        <FileText className="w-12 h-12 text-primary" />
        <span className="font-medium text-sm">PDF Preview Available</span>
        {sizeBytes !== undefined && (
          <span className="text-xs text-muted-foreground">{formatFileSize(sizeBytes)}</span>
        )}
        {previewUrl && (
          <iframe
            src={previewUrl}
            title={originalName}
            className="w-full h-64 mt-2 border rounded"
          />
        )}
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-muted/20 text-center gap-2">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={originalName}
            className="max-h-64 max-w-full rounded object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <ImageIcon className="w-12 h-12 text-primary" />
            <span className="font-medium text-sm">Image Preview Available</span>
            {sizeBytes !== undefined && (
              <span className="text-xs text-muted-foreground">{formatFileSize(sizeBytes)}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-muted/10 text-center gap-2">
      <FileCode className="w-12 h-12 text-muted-foreground" />
      <span className="text-sm text-muted-foreground font-medium">Preview not available</span>
      {sizeBytes !== undefined && (
        <span className="text-xs text-muted-foreground">{formatFileSize(sizeBytes)}</span>
      )}
    </div>
  );
};

export default FilePreview;
