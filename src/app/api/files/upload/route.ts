// LAN upload route — 050-files
// Authenticated actor, schema validation, streamed request handling, no active version on failure.

import { getActor } from "@/server/auth/getActor.js";
import { fileService, type UploadInput } from "@/server/files/index.js";
import { validateUploadInput, FileError, FileErrorCode } from "@/server/files/schemas.js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 600; // 10 minutes for large uploads

export async function POST(request: Request) {
  try {
    // Authenticate actor
    const actor = await getActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const workItemId = formData.get("workItemId") as string;
    const category = formData.get("category") as string;
    const file = formData.get("file") as File | null;
    const note = formData.get("note") as string | null;

    if (!workItemId || !category || !file) {
      return NextResponse.json(
        { error: "Missing required fields: workItemId, category, file" },
        { status: 400 }
      );
    }

    // Get file info
    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;

    // Validate input
    const validated = validateUploadInput(
      {
        workItemId,
        category,
        fileName,
        note: note ?? undefined,
        actorId: actor.id,
      },
      fileSize,
      mimeType
    );

    // Convert File to ReadableStream
    const stream = file.stream();

    // Upload via file service
    const fileVersion = await fileService.upload({
      workItemId: validated.workItemId,
      category: validated.category as UploadInput["category"],
      stream: stream as ReadableStream<Uint8Array>,
      fileName: validated.fileName,
      note: validated.note,
      actor: actor,
    });

    return NextResponse.json({
      id: fileVersion.id,
      fileAssetId: fileVersion.fileAssetId,
      fileObjectId: fileVersion.fileObjectId,
      versionNumber: fileVersion.versionNumber,
      originalName: fileVersion.originalName,
      status: fileVersion.status,
      approved: fileVersion.approved,
      createdAt: fileVersion.createdAt,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof FileError) {
      const statusMap: Record<string, number> = {
        [FileErrorCode.VALIDATION_ERROR]: 400,
        [FileErrorCode.FORBIDDEN]: 403,
        [FileErrorCode.SIZE_EXCEEDED]: 413,
        [FileErrorCode.MIME_UNSUPPORTED]: 415,
        [FileErrorCode.INCOMPLETE_UPLOAD]: 400,
        [FileErrorCode.CONCURRENT_VERSION_CONFLICT]: 409,
      };
      return NextResponse.json(
        { error: error.code, message: error.message, details: error.details },
        { status: statusMap[error.code] ?? 500 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("exceeds maximum")) {
        return NextResponse.json(
          { error: "SIZE_EXCEEDED", message: error.message },
          { status: 413 }
        );
      }
      if (error.message.includes("not in allowlist")) {
        return NextResponse.json(
          { error: "MIME_UNSUPPORTED", message: error.message },
          { status: 415 }
        );
      }
      if (error.message.includes("CONCURRENT_VERSION_CONFLICT")) {
        return NextResponse.json(
          { error: "CONCURRENT_VERSION_CONFLICT", message: "Concurrent version conflict, please retry" },
          { status: 409 }
        );
      }
    }

    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Upload failed" },
      { status: 500 }
    );
  }
}