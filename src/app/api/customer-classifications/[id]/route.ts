import { NextResponse } from "next/server";
import { deactivateClassification, updateClassification } from "~/server/customers";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name !== "string" || !body.name.trim()) throw new Error("INVALID_NAME");
    return NextResponse.json(await updateClassification((await context.params).id, body.name));
  } catch { return NextResponse.json({ error: "CLASSIFICATION_UPDATE_FAILED" }, { status: 400 }); }
}

export async function DELETE(_: Request, context: Context) {
  try { return NextResponse.json(await deactivateClassification((await context.params).id)); }
  catch { return NextResponse.json({ error: "CLASSIFICATION_DEACTIVATE_FAILED" }, { status: 400 }); }
}
