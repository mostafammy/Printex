// Expense receipt photo streaming — 052-finance FR-013 / T069.
// Entity-ownership authorization stays with 052 (050 files.md: "Entity
// ownership authorization remains with the consuming feature"): we require
// `finance.view` AND verify the target really is an Expense record before
// touching 050 storage — the second half of the spec's "re-check 052's read
// scope in addition to 050's download-route authorization".

import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getActor, authorize } from "~/server/auth";
import { db } from "~/server/db";
import { createLocalDiskAdapter } from "~/server/core/storage/local-disk";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  try {
    const actor = await getActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // 052 read scope: finance.view (grants visibility of finance surfaces).
    authorize(actor, "finance.view");

    const { expenseId } = await params;
    const expense = await db.expense.findUnique({ where: { id: expenseId }, select: { id: true } });
    if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const attachment = await db.attachment.findFirst({
      where: {
        entityType: "Expense",
        entityId: expenseId,
        status: { notIn: ["ARCHIVED", "VOID"] },
      },
      orderBy: { createdAt: "desc" },
      include: { fileObject: true },
    });
    if (!attachment || !attachment.fileObject) {
      return NextResponse.json({ error: "No receipt attached" }, { status: 404 });
    }

    const storage = createLocalDiskAdapter();
    const stream = await storage.getWithVerification(
      attachment.fileObject.storageKey,
      attachment.fileObject.sha256,
      Number(attachment.fileObject.sizeBytes),
    );
    const webStream = Readable.toWeb(stream as import("stream").Readable) as ReadableStream;
    const safeName = attachment.originalName.replace(/[\r\n"]+/g, "_");

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": attachment.fileObject.mimeType || "application/octet-stream",
        "Content-Length": attachment.fileObject.sizeBytes.toString(),
        "Content-Disposition": `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === "UnauthenticatedError" || name === "ForbiddenError") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[finance] receipt stream failed", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
