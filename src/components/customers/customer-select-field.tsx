"use client";

import { useState } from "react";
import { User, X } from "lucide-react";
import { CustomerPicker } from "./customer-picker";

export type CustomerSelectFieldProps = {
  /** Form field name the selected customer id is submitted under. */
  name?: string;
  required?: boolean;
  /**
   * The shop's single designated walk-in/anonymous customer row, if one
   * exists — surfaced as a one-click shortcut instead of making the cashier
   * type a search query for it.
   */
  cashCustomer?: { id: string; label: string } | null;
};

/**
 * Order-entry customer field: search-as-you-type (via `CustomerPicker`,
 * backed by `findCustomers`'s bounded/indexed lookup) instead of a native
 * `<select>` populated from every row in the Customer table. Manages the
 * "selected customer" form state client-side and submits it through a
 * single hidden input, so the surrounding page can stay a plain server
 * action form.
 */
export function CustomerSelectField({
  name = "customerId",
  required,
  cashCustomer,
}: CustomerSelectFieldProps) {
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name={name} value={selected?.id ?? ""} required={required} />

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm shadow-2xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {selected.label}
          </span>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="تغيير العميل"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <CustomerPicker
            autoFocus={false}
            onSelect={(customerId, label) => setSelected({ id: customerId, label })}
          />
          {cashCustomer && (
            <button
              type="button"
              onClick={() => setSelected({ id: cashCustomer.id, label: cashCustomer.label })}
              className="self-start text-xs font-semibold text-primary transition-colors hover:underline"
            >
              {cashCustomer.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
