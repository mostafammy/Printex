import { NextResponse } from "next/server";
import { findCustomers } from "~/server/customers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const customers = await findCustomers({
      text: searchParams.get("q") ?? "",
      includeArchived: searchParams.get("includeArchived") === "true",
    });
    return NextResponse.json(customers);
  } catch {
    return NextResponse.json({ error: "CUSTOMER_SEARCH_FAILED" }, { status: 400 });
  }
}
