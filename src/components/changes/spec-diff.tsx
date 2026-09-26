// spec-diff.tsx — Presentational table of specification field changes.
// tasks.md T056, contracts/spec-diff.md §<SpecDiff>. Server Component: no
// hooks, no client JS, no data fetching (product type names come from the page).

import type { JSX } from "react";
import type { SpecFieldChange } from "~/server/changes";
import ar from "~/messages/ar.json";

const D = ar.changes.diff;
const FIELD_LABELS = ar.changes.fields;
const UNIT_LABELS = ar.changes.dimensionUnit;
const NONE = "—";

const numberFormat = new Intl.NumberFormat("ar-EG", {
  maximumFractionDigits: 2,
});

export type SpecDiffProps = {
  changes: readonly SpecFieldChange[];
  /** productTypeId → display name; resolved by the page in one query, never inside the component. */
  productTypeNames?: Readonly<Record<string, string>>;
  /** Shown when changes is empty. Defaults to ar.json "changes.diff.none". */
  emptyLabel?: string;
  /** Optional caption, e.g. "v1 → v2" or "الحالي → المقترح". */
  caption?: string;
};

function formatDecimal(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? numberFormat.format(n) : value;
}

/** Renders one side (before or after) of a change; narrowing on `field` types the value. */
function formatValue(
  change: SpecFieldChange,
  side: "before" | "after",
  productTypeNames: Readonly<Record<string, string>>,
): string {
  switch (change.field) {
    case "quantity": {
      const v = change[side];
      return v === null ? NONE : numberFormat.format(v);
    }
    case "widthValue":
    case "heightValue": {
      const v = change[side];
      return v === null ? NONE : formatDecimal(v);
    }
    case "dimensionUnit": {
      const v = change[side];
      return v === null ? NONE : UNIT_LABELS[v];
    }
    case "productTypeId": {
      const v = change[side];
      return v === null ? NONE : (productTypeNames[v] ?? v);
    }
    case "description":
    case "material":
    case "finishNotes": {
      const v = change[side];
      return v ?? NONE;
    }
  }
}

export function SpecDiff({
  changes,
  productTypeNames = {},
  emptyLabel = D.none,
  caption,
}: SpecDiffProps): JSX.Element {
  if (changes.length === 0) {
    return (
      <p
        className="text-muted-foreground text-xs"
        data-testid="spec-diff-empty"
      >
        {caption ? `${caption}: ` : ""}
        {emptyLabel}
      </p>
    );
  }

  return (
    <table className="w-full border-collapse text-xs" data-testid="spec-diff">
      {caption && (
        <caption className="text-muted-foreground pb-1 text-start font-medium">
          {caption}
        </caption>
      )}
      <thead>
        <tr className="border-border text-muted-foreground border-b">
          <th scope="col" className="py-1 pe-3 text-start font-medium">
            {D.field}
          </th>
          <th scope="col" className="py-1 pe-3 text-start font-medium">
            {D.before}
          </th>
          <th scope="col" className="py-1 pe-3" aria-hidden="true" />
          <th scope="col" className="py-1 text-start font-medium">
            {D.after}
          </th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change) => (
          <tr
            key={change.field}
            data-field={change.field}
            data-kind={change.kind}
            className="border-border/50 border-b last:border-b-0"
          >
            <th
              scope="row"
              className="text-foreground py-1 pe-3 text-start font-medium"
            >
              {FIELD_LABELS[change.field]}
            </th>
            <td
              className={
                "text-muted-foreground py-1 pe-3 text-start" +
                (change.kind === "ADDED"
                  ? ""
                  : " decoration-muted-foreground/50 line-through")
              }
            >
              {formatValue(change, "before", productTypeNames)}
            </td>
            <td className="text-muted-foreground py-1 pe-3" aria-hidden="true">
              {D.arrow}
            </td>
            <td className="text-foreground py-1 text-start font-semibold">
              {formatValue(change, "after", productTypeNames)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
