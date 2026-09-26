// Unit tests for the change request UI helpers — tasks.md T051.
import { describe, expect, it } from "vitest";
import {
  copyChangedSpecFields,
  formatAge,
  specFieldLabel,
  specPatchFromFormData,
} from "~/components/changes/change-request-format";
import type { SpecSnapshot } from "~/server/changes";

const current: SpecSnapshot = {
  productTypeId: "pt1",
  description: "Banner",
  quantity: 500,
  widthValue: "1.5",
  heightValue: "2",
  dimensionUnit: "M",
  material: null,
  finishNotes: null,
};

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("copyChangedSpecFields", () => {
  it("copies only fields that differ, treating equal decimals as unchanged", () => {
    const out = new FormData();
    copyChangedSpecFields(
      form({
        quantity: "800",
        widthValue: "1.50",
        heightValue: "2",
        dimensionUnit: "M",
        material: " Vinyl ",
        description: "Banner",
        finishNotes: "",
      }),
      current,
      out,
    );
    expect([...out.keys()].sort()).toEqual(["material", "quantity"]);
    expect(out.get("quantity")).toBe("800");
    expect(out.get("material")).toBe("Vinyl");
  });

  it("sends a blank for a cleared field", () => {
    const out = new FormData();
    copyChangedSpecFields(
      form({
        quantity: "500",
        widthValue: "1.5",
        heightValue: "2",
        dimensionUnit: "M",
        description: "",
      }),
      current,
      out,
    );
    expect(out.get("description")).toBe("");
  });
});

describe("specPatchFromFormData", () => {
  it("builds a patch from present fields only", () => {
    expect(
      specPatchFromFormData(
        form({ quantity: "800", material: "", dimensionUnit: "CM" }),
      ),
    ).toEqual({
      quantity: 800,
      material: null,
      dimensionUnit: "CM",
    });
  });

  it("ignores a blank quantity and an unknown unit", () => {
    expect(
      specPatchFromFormData(form({ quantity: "", dimensionUnit: "FT" })),
    ).toEqual({});
  });

  it("clears decimals on blank", () => {
    expect(
      specPatchFromFormData(form({ widthValue: "", heightValue: "3.25" })),
    ).toEqual({
      widthValue: null,
      heightValue: "3.25",
    });
  });
});

describe("formatAge / specFieldLabel", () => {
  it("formats elapsed time in Arabic, largest unit first", () => {
    const now = new Date("2026-01-02T12:00:00Z");
    const hours = formatAge(new Date("2026-01-02T09:00:00Z"), now);
    expect(hours).toMatch(/[؀-ۿ]/);
    expect(hours).not.toBe(formatAge(new Date("2026-01-01T09:00:00Z"), now));
    expect(formatAge(now, now)).toMatch(/[؀-ۿ]/);
  });

  it("labels every spec field in Arabic", () => {
    expect(specFieldLabel("quantity")).toMatch(/[؀-ۿ]/);
    expect(specFieldLabel("productTypeId")).toMatch(/[؀-ۿ]/);
  });
});
