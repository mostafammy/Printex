"use client";

import { useState } from "react";
import { UserPlus, User, Phone, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";

export function CustomerForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, primaryPhone: phone }),
      });

      if (response.ok) {
        setStatus({ type: "success", text: "تم إنشاء العميل بنجاح" });
        setName("");
        setPhone("");
      } else {
        setStatus({ type: "error", text: "تعذر إنشاء العميل. يرجى التأكد من صحة البيانات." });
      }
    } catch {
      setStatus({ type: "error", text: "حدث خطأ في الاتصال بالخادم." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground " +
    "placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/25 " +
    "disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-2xs";

  return (
    <form
      onSubmit={submit}
      dir="rtl"
      className="apple-card flex flex-col gap-4 p-6 sm:p-7 max-w-lg"
    >
      <div className="flex items-center gap-2.5 pb-1 border-b border-border/60">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">تسجيل عميل جديد</h2>
          <p className="text-xs text-muted-foreground">إضافة بيانات العميل الأساسية للنظام</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span>اسم العميل</span>
        </label>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="مثال: شركة الأمل للدعاية..."
          disabled={isSubmitting}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <span>رقم الهاتف الأساسي</span>
        </label>
        <input
          required
          type="tel"
          dir="ltr"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+20 100 000 0000"
          disabled={isSubmitting}
          className={inputCls + " text-start"}
        />
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          variant="default"
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>جاري الإنشاء...</span>
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              <span>إنشاء العميل</span>
            </>
          )}
        </Button>
      </div>

      {status && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl p-3 text-xs font-medium border ${
            status.type === "success"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{status.text}</span>
        </div>
      )}
    </form>
  );
}
