// Lifecycle route — 050-files
// void/archive/supersede with reason validation and server authorization

import { getActor } from "@/server/auth/getActor.js";
import { fileService, authorizeFileLifecycle, authorizeFileApprove } from "@/server/files/index.js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const body = (await request.json()) as { action?: string; reason?: string; actorId?: string };
    const { action, reason, actorId } = body;

    if (!action || !reason) {
      return NextResponse.json(
        { error: "Missing action or reason" },
        { status: 400 }
      );
    }

    // Authenticate actor
    const actor = await getActor(request);
    if (!actor || actor.id !== actorId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    switch (action) {
      case "VOID": {
        await authorizeFileLifecycle(actor, versionId, "VOID");
        await fileService.voidVersion(versionId, actor, reason);
        break;
      }
      case "ARCHIVE": {
        await authorizeFileLifecycle(actor, versionId, "ARCHIVE");
        await fileService.archiveVersion(versionId, actor, reason);
        break;
      }
      case "APPROVE": {
        await authorizeFileApprove(actor, versionId);
        await fileService.markApproved(versionId, actor);
        break;
      }
      default:
        return NextResponse.json(
          { error: "Invalid action. Use VOID, ARCHIVE, or APPROVE" },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, action });

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN" || error.message.includes("Insufficient permissions")) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    }
    console.error("Lifecycle error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Lifecycle operation failed" },
      { status: 500 }
    );
  }
}