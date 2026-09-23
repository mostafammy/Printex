"use client";

import { useState } from "react";

export function CustomerForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, primaryPhone: phone }) });
    setMessage(response.ok ? "تم إنشاء العميل" : "تعذر إنشاء العميل");
  }

  return (
    <form onSubmit={submit} dir="rtl" className="space-y-4">
      <label className="block">الاسم<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      <label className="block">الهاتف<input required value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      <button type="submit" className="rounded bg-primary px-4 py-2 text-primary-foreground">إنشاء العميل</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
