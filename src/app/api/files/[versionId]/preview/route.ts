// Signed preview route — 050-files
// Re-authorization, SHA-256 verification, image/PDF preview vs metadata/icon

import { getActor } from "@/server/auth/getActor.js";
import { authorizeFileDownload } from "@/server/files/index.js";
import { decodeAndVerifyGrant } from "@/server/files/signed-preview.js";
import { mapFileError } from "@/server/files/errors.js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const url = new URL(request.url);
    const grantToken = url.searchParams.get("grant");

    if (!grantToken) {
      return NextResponse.json({ error: "Missing grant token" }, { status: 400 });
    }

    // Decode and verify grant
    let payload;
    try {
      payload = decodeAndVerifyGrant(grantToken);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "PREVIEW_GRANT_EXPIRED") {
          return NextResponse.json({ error: "EXPIRED_GRANT" }, { status: 403 });
        }
        if (error.message === "PREVIEW_GRANT_TAMPERED") {
          return NextResponse.json({ error: "INVALID_GRANT" }, { status: 403 });
        }
      }
      return NextResponse.json({ error: "INVALID_GRANT" }, { status: 403 });
    }

    // Verify version matches
    if (payload.v !== versionId || payload.s !== "preview") {
      return NextResponse.json({ error: "VERSION_MISMATCH" }, { status: 403 });
    }

    // Authenticate actor
    const actor = await getActor(request);
    if (!actor || actor.id !== payload.a) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Re-authorize
    await authorizeFileDownload(actor, versionId);

    // Get file version with file object
    const { db: prisma } = await import("@/server/db.js");
    const fileVersion = await prisma.fileVersion.findUnique({
      where: { id: versionId },
      include: { fileObject: true },
    });

    if (!fileVersion || !fileVersion.fileObject) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // For preview scope, return metadata + thumbnail info
    // The actual thumbnail generation would be a separate service
    // For now, return preview metadata
    const fileObject = fileVersion.fileObject;
    const isPreviewable = fileObject.mimeType.startsWith("image/") ||
                         fileObject.mimeType === "application/pdf";

    return NextResponse.json({
      versionId: fileVersion.id,
      versionNumber: fileVersion.versionNumber,
      originalName: fileVersion.originalName,
      mimeType: fileObject.mimeType,
      sizeBytes: fileObject.sizeBytes,
      sha256: fileObject.sha256,
      previewable: isPreviewable,
      previewType: fileObject.mimeType.startsWith("image/") ? "image" :
                   fileObject.mimeType === "application/pdf" ? "pdf" : "icon",
      // For actual preview, client would call download route with grant
      downloadUrl: `/api/files/${versionId}/download?grant=${encodeURIComponent(url.searchParams.get("grant") || "")}`,
    });

  } catch (error) {
    return mapFileError(error);
  }
}