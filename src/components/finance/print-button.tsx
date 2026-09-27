"use client";

// Print trigger for the receipt page (US8 / FR-022) — client-side
// trigger for window.print().

import { Printer } from "lucide-react";
import { Button } from "~/components/ui/button";

export function PrintButton() {
  return (
    <Button
      type="button"
      variant="default"
      onClick={() => window.print()}
      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
    >
      <Printer className="h-4 w-4" />
      <span>طباعة الإيصال</span>
    </Button>
  );
}
