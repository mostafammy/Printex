import { NextResponse } from "next/server";
import { archiveCustomer, customerInput, getCustomer, updateCustomer } from "~/server/customers";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  try {
    const customer = await getCustomer((await context.params).id);
    return customer ? NextResponse.json(customer) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "CUSTOMER_READ_FAILED" }, { status: 400 });
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const customer = await updateCustomer((await context.params).id, customerInput.parse(await request.json()));
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "CUSTOMER_UPDATE_FAILED" }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const customer = await archiveCustomer((await context.params).id);
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "CUSTOMER_ARCHIVE_FAILED" }, { status: 400 });
  }
}
