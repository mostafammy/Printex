import { NextResponse } from "next/server";
import { findCustomerPricingRules } from "~/server/pricing";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rules = await findCustomerPricingRules(id);
    return NextResponse.json(rules);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("FORBIDDEN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
