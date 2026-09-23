import { NextResponse } from "next/server";
import { promoteCashBuyer } from "~/server/customers";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { input?: Parameters<typeof promoteCashBuyer>[0]; orderIds?: string[]; reason?: string };
    if (!body.input || !body.orderIds || !body.reason) throw new Error("INVALID_PROMOTION");
    return NextResponse.json(await promoteCashBuyer(body.input, body.orderIds, body.reason), { status: 201 });
  } catch { return NextResponse.json({ error: "CUSTOMER_PROMOTION_FAILED" }, { status: 400 }); }
}
