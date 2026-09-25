"use client";

// Print trigger for the receipt page (US8 / FR-022) — the only client-side
// piece in 052; everything else is server-rendered.

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
    >
      🖨
    </button>
  );
}
