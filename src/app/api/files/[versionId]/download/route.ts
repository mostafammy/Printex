// Authenticated streaming download route — 050-files
// Re-authorization, SHA-256 verification, 64KB chunks, 30s per-chunk, 5min total timeout

import { getActor } from "~/server/auth";
import { authorizeFileDownload } from "~/server/files";
import { mapFileError } from "~/server/files/errors";
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
    const { db: prisma } = await import("@/server/db.js");
    const fileVersion = await prisma.fileVersion.findUnique({
      where: { id: versionId },
      include: { fileObject: true },
    });

    if (!fileVersion?.fileObject) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileObject = fileVersion.fileObject;
    const storageAdapter = (await import("@/server/core/storage/local-disk.js"))
      .createLocalDiskAdapter();

    // Get stream with checksum verification
    const stream = await storageAdapter.getWithVerification(
      fileObject.storageKey,
      fileObject.sha256,
      Number(fileObject.sizeBytes)
    );

    // Convert Node stream to Web stream
    const webStream = Readable.toWeb(stream);

    // Return streaming response
    return new Response(webStream as unknown as BodyInit, {
      status: 200,
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