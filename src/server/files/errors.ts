// Route-level error mapping — 050-files
// Maps internal errors to HTTP responses

import { FileError, FileErrorCode } from "./schemas.js";
import { NextResponse } from "next/server";

export function mapFileError(error: unknown): NextResponse {
  if (error instanceof FileError) {
    const statusMap: Record<FileErrorCode, number> = {
      [FileErrorCode.VALIDATION_ERROR]: 400,
      [FileErrorCode.FORBIDDEN]: 403,
      [FileErrorCode.NOT_FOUND]: 404,
      [FileErrorCode.CHECKSUM_MISMATCH]: 500,
      [FileErrorCode.EXPIRED_GRANT]: 403,
      [FileErrorCode.INCOMPLETE_UPLOAD]: 400,
      [FileErrorCode.SIZE_EXCEEDED]: 413,
      [FileErrorCode.MIME_UNSUPPORTED]: 415,
      [FileErrorCode.CHECKSUM_VERIFICATION_FAILED]: 500,
      [FileErrorCode.CONCURRENT_VERSION_CONFLICT]: 409,
      [FileErrorCode.INVALID_GRANT]: 403,
      [FileErrorCode.UPLOAD_CLEANUP_FAILED]: 500,
    };

    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        details: error.details
      },
      { status: statusMap[error.code] ?? 500 }
    );
  }

  if (error instanceof Error) {
    if (error.message.includes("exceeds maximum")) {
      return NextResponse.json(
        { error: FileErrorCode.SIZE_EXCEEDED, message: error.message },
        { status: 413 }
      );
    }
    if (error.message.includes("not in allowlist")) {
      return NextResponse.json(
        { error: FileErrorCode.MIME_UNSUPPORTED, message: error.message },
        { status: 415 }
      );
    }
    if (error.message.includes("CONCURRENT_VERSION_CONFLICT")) {
      return NextResponse.json(
        { error: FileErrorCode.CONCURRENT_VERSION_CONFLICT, message: "Concurrent version conflict, please retry" },
        { status: 409 }
      );
    }
    if (error.message === "PREVIEW_GRANT_EXPIRED") {
      return NextResponse.json({ error: FileErrorCode.EXPIRED_GRANT }, { status: 403 });
    }
    if (error.message === "PREVIEW_GRANT_TAMPERED") {
      return NextResponse.json({ error: FileErrorCode.INVALID_GRANT }, { status: 403 });
    }
    if (error.message === "FORBIDDEN" || error.message.includes("Insufficient permissions")) {
      return NextResponse.json({ error: FileErrorCode.FORBIDDEN }, { status: 403 });
    }
    if (error.message.includes("Checksum mismatch") || error.message.includes("Size mismatch")) {
      return NextResponse.json(
        { error: FileErrorCode.CHECKSUM_MISMATCH, message: "File integrity verification failed" },
        { status: 500 }
      );
    }
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: FileErrorCode.NOT_FOUND }, { status: 404 });
    }
  }

  console.error("Unhandled file error:", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    { status: 500 }
  );
}