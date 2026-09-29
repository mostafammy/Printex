/** @vitest-environment jsdom */
// tests/components/shell-loading.test.tsx — T003 (092-performance, US1).
//
// AC-003 / AC-004 / FR-005..FR-007 / SR-001..SR-003:
// - (shell)/loading.tsx exists, renders skeleton markup with aria-busy,
//   and carries NO operational data (honest fallback — never stale content)
// - no aria-live region and no focus-management in the boundary
//   (Clarifications 2026-09-29 Q5: aria-busy only)
// - the three Suspense sites exist: OrderFinancePanel, SpecHistory rows,
//   CustomerBalanceTab (AC-004)
//
// Tests-first per tasks.md Phase 2 ("fails until T006–T009").

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(resolve(process.cwd(), rel), "utf8");

describe("(shell) loading boundary (T003)", () => {
  it("exists and renders an honest skeleton (FR-005, FR-007, SR-001)", () => {
    const source = read("src/app/(shell)/loading.tsx");

    expect(source).toContain("aria-busy");
    expect(source).toContain("animate-pulse");
    // No operational data fields may appear in the fallback (FR-007).
    expect(source).not.toMatch(/orders?\.number|workItemId|unreadCount|price/i);
    // SR-003 / Clarifications Q5: no live region, no focus moves.
    expect(source).not.toContain("aria-live");
    expect(source).not.toMatch(/\.focus\(|autoFocus/);
  });

  it("navigation render case: the loading boundary is the segment-level fallback for every (shell) route", () => {
    // The file must live at the segment root so Next.js wires it as the
    // loading state for ALL authenticated routes (AC-003).
    const source = read("src/app/(shell)/loading.tsx");
    expect(source).toContain("export default function Loading");
  });

  it("Suspense wraps the three expensive async sections (AC-004, FR-006)", () => {
    const orderPage = read("src/app/(shell)/orders/[orderId]/page.tsx");
    expect(orderPage).toContain("<Suspense");
    expect(orderPage).toMatch(/<Suspense[\s\S]*<OrderFinancePanel/);
    expect(orderPage).toMatch(/<Suspense[\s\S]*<SpecHistory/);

    const customerPage = read("src/app/(shell)/customers/[id]/page.tsx");
    expect(customerPage).toMatch(/<Suspense[\s\S]*<CustomerBalanceTab/);
  });

  it("Suspense fallbacks carry aria-busy and no stale data (FR-007, SR-003)", () => {
    const orderPage = read("src/app/(shell)/orders/[orderId]/page.tsx");
    expect(orderPage).toContain('aria-busy="true"');
    expect(orderPage).not.toContain("aria-live");
  });
});
