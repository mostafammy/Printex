// tests/unit/changes/spec-diff-render.test.ts
// tasks.md T053, contracts/spec-diff.md §Render test. A `.ts` file: the
// component is called as a function, so no JSX is needed here.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpecDiff } from "~/components/changes/spec-diff";
import type { SpecFieldChange } from "~/server/changes";
import ar from "~/messages/ar.json";

const fmt = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

function render(props: Parameters<typeof SpecDiff>[0]): string {
  return renderToStaticMarkup(SpecDiff(props));
}

function rows(html: string): { field: string; kind: string }[] {
  return [
    ...html.matchAll(/<tr data-field="([^"]+)" data-kind="([^"]+)"/g),
  ].map((m) => ({
    field: m[1]!,
    kind: m[2]!,
  }));
}

describe("<SpecDiff> render (T053)", () => {
  it("renders one data-field row per change with labels and ar-EG numbers (US4-1)", () => {
    const changes: SpecFieldChange[] = [
      { field: "quantity", kind: "CHANGED", before: 500, after: 800 },
      { field: "widthValue", kind: "CHANGED", before: "1.5", after: "2.25" },
      { field: "dimensionUnit", kind: "CHANGED", before: "CM", after: "M" },
    ];
    const html = render({ changes, caption: "v1 → v2" });

    expect(rows(html)).toEqual([
      { field: "quantity", kind: "CHANGED" },
      { field: "widthValue", kind: "CHANGED" },
      { field: "dimensionUnit", kind: "CHANGED" },
    ]);
    expect(html).toContain(ar.changes.fields.quantity);
    expect(html).toContain(fmt(500));
    expect(html).toContain(fmt(800));
    expect(html).toContain(fmt(2.25));
    expect(html).toContain(ar.changes.dimensionUnit.CM);
    expect(html).toContain(ar.changes.dimensionUnit.M);
    expect(html).toContain("v1 → v2");
  });

  it("renders — for null on either side (ADDED / REMOVED)", () => {
    const changes: SpecFieldChange[] = [
      { field: "material", kind: "ADDED", before: null, after: "Vinyl" },
      { field: "finishNotes", kind: "REMOVED", before: "Glossy", after: null },
    ];
    const html = render({ changes });

    expect(rows(html)).toEqual([
      { field: "material", kind: "ADDED" },
      { field: "finishNotes", kind: "REMOVED" },
    ]);
    expect(html.match(/<td[^>]*>—<\/td>/g)).toHaveLength(2);
    expect(html).toContain("Vinyl");
    expect(html).toContain("Glossy");
  });

  it("renders the empty label for [] (default and custom)", () => {
    const html = render({ changes: [] });
    expect(rows(html)).toEqual([]);
    expect(html).toContain(ar.changes.diff.none);
    expect(html).toContain('data-testid="spec-diff-empty"');

    expect(render({ changes: [], emptyLabel: "لا شيء" })).toContain("لا شيء");
  });

  it("shows product type names from productTypeNames, falling back to the id", () => {
    const changes: SpecFieldChange[] = [
      {
        field: "productTypeId",
        kind: "CHANGED",
        before: "pt_a",
        after: "pt_b",
      },
    ];
    const html = render({
      changes,
      productTypeNames: { pt_a: "بنر", pt_b: "ستيكر" },
    });
    expect(html).toContain("بنر");
    expect(html).toContain("ستيكر");
    expect(html).not.toContain("pt_a");

    expect(render({ changes })).toContain("pt_b");
  });
});
