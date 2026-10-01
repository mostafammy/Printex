"use client";

import React, { useState, useId } from "react";
import {
  X,
  Search,
  UserCheck,
  Coins,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type { CustomerSummary } from "./types";

export interface CustomerSelectModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSelect: (customer: CustomerSummary) => void;
  readonly customers: readonly CustomerSummary[];
  readonly cashCustomer: CustomerSummary | null;
  readonly onQuickCreateCustomer?: (input: {
    name: string;
    phone: string;
    notes?: string;
  }) => Promise<CustomerSummary | null>;
}

export function CustomerSelectModal({
  isOpen,
  onClose,
  onSelect,
  customers,
  cashCustomer,
  onQuickCreateCustomer,
}: CustomerSelectModalProps) {
  const generatedId = useId();
  const [activeTab, setActiveTab] = useState<"SELECT" | "CREATE">("SELECT");
  const [searchTerm, setSearchTerm] = useState("");

  // Create form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const filteredCustomers = customers.filter((c) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      (c.phone?.includes(term) ?? false)
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMessage("يرجى إدخال اسم العميل");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      if (onQuickCreateCustomer) {
        const created = await onQuickCreateCustomer({
          name: newName.trim(),
          phone: newPhone.trim(),
          notes: newNotes.trim() || undefined,
        });
        if (created) {
          onSelect(created);
          onClose();
          return;
        }
      } else {
        // Fallback local dummy if server action not wired
        const dummy: CustomerSummary = {
          id: `cust_${Date.now()}`,
          name: newName.trim(),
          phone: newPhone.trim(),
        };
        onSelect(dummy);
        onClose();
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "فشل إنشاء العميل، يرجى التحقق من البيانات"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-white/20 bg-card shadow-2xl overflow-hidden text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {activeTab === "SELECT" ? "اختيار العميل للطلب" : "إضافة عميل جديد"}
              </h2>
              <p className="text-2xs text-muted-foreground">
                ربط أمر الطباعة بحساب العميل والملف المالي
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-border/60 bg-muted/40 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("SELECT")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === "SELECT"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            بحث واختيار عميل مسجل
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("CREATE")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === "CREATE"
                ? "bg-card text-primary shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            + تسجيل عميل جديد
          </button>
        </div>

        {/* Content */}
        {activeTab === "SELECT" ? (
          <div className="flex flex-col p-5 gap-3 flex-1 overflow-hidden">
            {/* Cash Customer Quick Button */}
            {cashCustomer && (
              <button
                type="button"
                onClick={() => {
                  onSelect(cashCustomer);
                  onClose();
                }}
                className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-start hover:bg-amber-500/15 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                    <Coins className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      عميل نقدي / مبيعات شباك (Cash Customer)
                    </span>
                    <span className="text-3xs text-muted-foreground">
                      طلب فوري بدون فتح حساب دائم
                    </span>
                  </div>
                </div>
                <span className="rounded-lg bg-amber-500/20 px-2 py-1 text-3xs font-black text-amber-700 dark:text-amber-300">
                  اختيار سريع
                </span>
              </button>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الهاتف..."
                className="w-full rounded-xl border border-border/80 bg-background ps-9 pe-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* Customers list */}
            <div className="flex-1 overflow-y-auto max-h-64 space-y-1.5 divide-y divide-border/30">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => {
                      onSelect(cust);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-start hover:bg-muted/60 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {cust.name.slice(0, 1)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          {cust.name}
                        </span>
                        {cust.phone ? (
                          <span className="text-3xs text-muted-foreground font-mono">
                            {cust.phone}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span className="rounded-md bg-muted px-2 py-0.5 text-3xs text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary font-semibold">
                      تحديد
                    </span>
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  لا يوجد عميل مطابق للبحث
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            {errorMessage ? (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                {errorMessage}
              </div>
            ) : null}

            <div>
              <label htmlFor={`new-customer-name-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
                اسم العميل / الشركة*
              </label>
              <input
                id={`new-customer-name-${generatedId}`}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: شركة النور للدعاية والإعلان"
                className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor={`new-customer-phone-${generatedId}`} className="block text-xs font-bold text-foreground mb-1">
                رقم الهاتف (موبايل / واتساب)*
              </label>
              <input
                id={`new-customer-phone-${generatedId}`}
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor={`new-customer-notes-${generatedId}`} className="block text-xs font-bold text-muted-foreground mb-1">
                ملاحظات
              </label>
              <textarea
                id={`new-customer-notes-${generatedId}`}
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="أي تفاصيل تخص العميل..."
                className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("SELECT")}
                className="rounded-xl"
              >
                رجوع
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl font-bold"
              >
                {isSubmitting ? "جاري الحفظ..." : "حفظ واختيار العميل"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
