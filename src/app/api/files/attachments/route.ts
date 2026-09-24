// Attachment upload/download route — 050-files
// Generic evidence attachments for rejection, discrepancy, expense, audit event, message

import { getActor } from "@/server/auth/getActor.js";
import { fileService, attachments } from "@/server/files/index.js";
import { validateAttachmentInput } from "@/server/files/schemas.js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const includeArchived = searchParams.get("includeArchived") === "true";

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "Missing required query parameters: entityType, entityId" },
        { status: 400 }
      );
    }

    const list = await attachments.list({ entityType, entityId, includeArchived });
    return NextResponse.json({ attachments: list });
  } catch (error) {
    console.error("List attachments error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to list attachments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Authenticate actor
    const actor = await getActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const entityType = formData.get("entityType") as string;
    const entityId = formData.get("entityId") as string;
    const file = formData.get("file") as File | null;
    const kind = formData.get("kind") as "VOICE_NOTE" | "IMAGE" | "FILE";

    if (!entityType || !entityId || !file || !kind) {
      return NextResponse.json(
        { error: "Missing required fields: entityType, entityId, file, kind" },
        { status: 400 }
      );
    }

    // Validate
    const validated = validateAttachmentInput({
      entityType,
      entityId,
      fileName: file.name,
      kind,
      createdById: actor.id,
      fileSize: file.size,
      mimeType: file.type,
    });

    // Upload via file service
    const attachmentId = await fileService.attach({
      entityType: validated.entityType,
      entityId: validated.entityId,
      stream: file.stream() as any,
      fileName: validated.fileName,
      kind: validated.kind,
      actor: { id: actor.id } as any,
    });

    return NextResponse.json({ id: attachmentId }, { status: 201 });

  } catch (error) {
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
      if (error.message.includes("Invalid filename")) {
        return NextResponse.json(
          { error: "VALIDATION_ERROR", message: error.message },
          { status: 400 }
        );
      }
    }
    console.error("Attachment upload error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Attachment upload failed" },
      { status: 500 }
    );
  }
}