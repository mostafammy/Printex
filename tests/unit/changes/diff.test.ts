import { describe, expect, expectTypeOf, it } from "vitest";
import {
  diffSpecSnapshots,
  type SpecFieldChange,
} from "~/server/changes/diff";
import {
  SPEC_FIELDS,
  type SpecSnapshot,
} from "~/server/changes/specFields";

function makeSnapshot(overrides: Partial<SpecSnapshot> = {}): SpecSnapshot {
  return {
    productTypeId: "pt_1",
    description: "Standard Banner",
    quantity: 100,
    widthValue: "10",
    heightValue: "20",
    dimensionUnit: "CM",
    material: "Vinyl",
    finishNotes: "Matte",
    ...overrides,
  };
}

describe("diffSpecSnapshots (T015)", () => {
  it("detects quantity only change (US4-1)", () => {
    const before = makeSnapshot({ quantity: 500 });
    const after = makeSnapshot({ quantity: 800 });

    const diff = diffSpecSnapshots(before, after);
    expect(diff).toEqual([
      {
        field: "quantity",
        kind: "CHANGED",
        before: 500,
        after: 800,
      },
    ]);
  });

  it("detects null → value as ADDED (US4-2)", () => {
    const before = makeSnapshot({ description: null });
    const after = makeSnapshot({ description: "Added description" });

    const diff = diffSpecSnapshots(before, after);
    expect(diff).toEqual([
      {
        field: "description",
        kind: "ADDED",
        before: null,
        after: "Added description",
      },
    ]);
  });

  it('treats "1.50" and "1.5" as identical (US4-3)', () => {
    const before = makeSnapshot({ widthValue: "1.50" });
    const after = makeSnapshot({ widthValue: "1.5" });

    const diff = diffSpecSnapshots(before, after);
    expect(diff).toEqual([]);
  });

  it("detects value → null as REMOVED", () => {
    const before = makeSnapshot({ finishNotes: "Matte" });
    const after = makeSnapshot({ finishNotes: null });

    const diff = diffSpecSnapshots(before, after);
    expect(diff).toEqual([
      {
        field: "finishNotes",
        kind: "REMOVED",
        before: "Matte",
        after: null,
      },
    ]);
  });

  it("returns multi-field changes in exact SPEC_FIELDS order", () => {
    const before = makeSnapshot({
      finishNotes: "Matte",
      quantity: 100,
      productTypeId: "pt_1",
      widthValue: "10",
    });
    const after = makeSnapshot({
      finishNotes: "Glossy",
      quantity: 200,
      productTypeId: "pt_2",
      widthValue: "15",
    });

    const diff = diffSpecSnapshots(before, after);
    const changedFields = diff.map((d) => d.field);

    expect(changedFields).toEqual([
      "productTypeId",
      "quantity",
      "widthValue",
      "finishNotes",
    ]);

    // Verify ordering matches SPEC_FIELDS order
    const expectedOrder = SPEC_FIELDS.filter((f) => changedFields.includes(f));
    expect(changedFields).toEqual(expectedOrder);
  });

  it("returns empty array for identical snapshots", () => {
    const snap = makeSnapshot();
    expect(diffSpecSnapshots(snap, snap)).toEqual([]);
  });

  it("detects productTypeId change", () => {
    const before = makeSnapshot({ productTypeId: "pt_1" });
    const after = makeSnapshot({ productTypeId: "pt_2" });

    const diff = diffSpecSnapshots(before, after);
    expect(diff).toEqual([
      {
        field: "productTypeId",
        kind: "CHANGED",
        before: "pt_1",
        after: "pt_2",
      },
    ]);
  });

  it("detects dimensionUnit change", () => {
    const before = makeSnapshot({ dimensionUnit: "CM" });
    const after = makeSnapshot({ dimensionUnit: "MM" });

    const diff = diffSpecSnapshots(before, after);
    expect(diff).toEqual([
      {
        field: "dimensionUnit",
        kind: "CHANGED",
        before: "CM",
        after: "MM",
      },
    ]);
  });

  it("narrows before/after type when narrowing field === quantity (expectTypeOf)", () => {
    const diff = diffSpecSnapshots(
      makeSnapshot({ quantity: 10 }),
      makeSnapshot({ quantity: 20 }),
    );
    const change = diff[0];
    expect(change).toBeDefined();

    if (change && change.field === "quantity") {
      expectTypeOf(change.before).toEqualTypeOf<number | null>();
      expectTypeOf(change.after).toEqualTypeOf<number | null>();
    }

    type QuantityChange = Extract<SpecFieldChange, { field: "quantity" }>;
    expectTypeOf<QuantityChange["before"]>().toEqualTypeOf<number | null>();
    expectTypeOf<QuantityChange["after"]>().toEqualTypeOf<number | null>();
  });

  it('diff: "1.50" → "2.00" gives before "1.5", after "2"', () => {
    const before = makeSnapshot({ widthValue: "1.50" });
    const after = makeSnapshot({ widthValue: "2.00" });

    const diff = diffSpecSnapshots(before, after);
    expect(diff).toEqual([
      {
        field: "widthValue",
        kind: "CHANGED",
        before: "1.5",
        after: "2",
      },
    ]);
  });
});
