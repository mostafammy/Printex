import { NextResponse } from "next/server";
import { createCustomer, customerInput } from "~/server/customers";

export async function POST(request: Request) {
  try {
    const customer = await createCustomer(customerInput.parse(await request.json()));
    return NextResponse.json(customer, { status: 201 });
  } catch {
    return NextResponse.json({ error: "CUSTOMER_CREATE_FAILED" }, { status: 400 });
  }
}
