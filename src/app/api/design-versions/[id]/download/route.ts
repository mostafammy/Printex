import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { db } from "~/server/db";
import { getActor } from "~/server/auth";
import { LocalDiskStorageAdapter } from "~/server/core";
import type { StorageAdapter } from "~/server/core";
import { authorizeDownload } from "./authorize";

// Module-level singleton, same lazy-global pattern as `src/server/designers/designVersions.ts`
const globalForStorage = globalThis as unknown as {
  downloadStorageAdapter: StorageAdapter | undefined;
};
function getStorageAdapter(): StorageAdapter {
  return (globalForStorage.downloadStorageAdapter ??= new LocalDiskStorageAdapter(
    env.STORAGE_ROOT ?? "./.storage",
  ));
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[\r\n\0]/g, "").replace(/"/g, '\\"');
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await getActor();
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const designVersion = await db.designVersion.findUnique({
      where: { id },
      include: {
        workItem: {
          select: {
            id: true,
            departmentId: true,
            assigneeId: true,
            productType: { select: { defaultDepartmentId: true } },
          },
        },
      },
    });

    if (!designVersion?.workItem) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    authorizeDownload(actor, designVersion);

    let nodeStream: NodeJS.ReadableStream;
    try {
      nodeStream = await getStorageAdapter().get(designVersion.storageKey);
    } catch {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const safeFileName = sanitizeFileName(designVersion.fileName);
    const webStream = Readable.toWeb(nodeStream as Readable);

    return new Response(webStream as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": designVersion.mimeType ?? "application/octet-stream",
        "Content-Length": designVersion.sizeBytes.toString(),
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
      },
    });
  } catch (caught) {
    if (
      caught instanceof Error &&
      (caught.name === "ForbiddenError" ||
        caught.name === "UnauthenticatedError" ||
        caught.message === "FORBIDDEN" ||
        caught.message === "UNAUTHENTICATED")
    ) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
