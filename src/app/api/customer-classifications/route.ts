import { NextResponse } from "next/server";
import { createClassification, findClassifications } from "~/server/customers";

export async function GET() {
  try { return NextResponse.json(await findClassifications()); }
  catch { return NextResponse.json({ error: "CLASSIFICATION_READ_FAILED" }, { status: 400 }); }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name !== "string" || !body.name.trim()) throw new Error("INVALID_NAME");
    return NextResponse.json(await createClassification(body.name), { status: 201 });
  } catch { return NextResponse.json({ error: "CLASSIFICATION_CREATE_FAILED" }, { status: 400 }); }
}
