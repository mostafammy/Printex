// Authenticated streaming download route — 050-files
// Re-authorization, SHA-256 verification, 64KB chunks, 30s per-chunk, 5min total timeout

import { getActor } from "@/server/auth/getActor.js";
import { fileService, authorizeFileDownload } from "@/server/files/index.js";
import { verifyStreamIntegrity } from "@/server/files/integrity.js";
import { NextResponse } from "next/server";
import { createReadStream } from "fs";
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
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    // Return streaming response
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": fileVersion.fileObject.mimeType,
        "Content-Length": fileObject.sizeBytes.toString(),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileVersion.originalName)}"`,
        "X-File-Version": fileVersion.versionNumber.toString(),
        "X-File-Checksum": fileVersion.fileObject.sha256,
      },
    });

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PREVIEW_GRANT_EXPIRED" || error.message === "PREVIEW_GRANT_TAMPERED") {
        return NextResponse.json({ error: "EXPIRED_GRANT" }, { status: 403 });
      }
      if (error.message === "FORBIDDEN" || error.message.includes("Insufficient permissions")) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
      if (error.message.includes("Checksum mismatch") || error.message.includes("Size mismatch")) {
        return NextResponse.json(
          { error: "CHECKSUM_MISMATCH", message: "File integrity verification failed" },
          { status: 500 }
        );
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
    }

    console.error("Download error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Download failed" },
      { status: 500 }
    );
  }
}