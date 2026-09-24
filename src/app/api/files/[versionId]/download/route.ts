// Authenticated streaming download route — 050-files
// Re-authorization, SHA-256 verification, 64KB chunks, 30s per-chunk, 5min total timeout

import { getActor } from "@/server/auth/getActor.js";
import { fileService, authorizeFileDownload } from "@/server/files/index.js";
import { verifyStreamIntegrity } from "@/server/files/integrity.js";
import { mapFileError } from "@/server/files/errors.js";
import { NextResponse } from "next/server";
import { Readable } from "stream";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes total

export async function GET(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;

    // Authenticate actor
    const actor = await getActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Re-authorize
    await authorizeFileDownload(actor, versionId);

    // Get file version with file object
    const { prisma } = await import("@/server/db/client.js");
    const fileVersion = await prisma.fileVersion.findUnique({
      where: { id: versionId },
      include: { fileObject: true },
    });

    if (!fileVersion || !fileVersion.fileObject) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileObject = fileVersion.fileObject;
    const storageAdapter = (await import("@/server/core/storage/local-disk.js"))
      .createLocalDiskAdapter();

    // Get stream with checksum verification
    const stream = await storageAdapter.getWithVerification(
      fileObject.storageKey,
      fileObject.sha256,
      fileObject.sizeBytes
    );

    // Convert Node stream to Web stream
    const webStream = Readable.toWeb(stream) as ReadableStream;

    // Return streaming response
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": fileVersion.fileObject.mimeType,
        "Content-Length": fileObject.sizeBytes.toString(),
        "Content-Disposition": `attachment; filename="${fileVersion.originalName.replace(/[^\x20-\x7E]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileVersion.originalName)}`,
        "X-File-Version": fileVersion.versionNumber.toString(),
        "X-File-Checksum": fileVersion.fileObject.sha256,
      },
    });

  } catch (error) {
    return mapFileError(error);
  }
}