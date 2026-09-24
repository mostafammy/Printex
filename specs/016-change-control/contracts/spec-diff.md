# Contracts: Specification Diff

## `diffSpecSnapshots` (`src/server/changes/diff.ts`, pure)

```ts
type SpecValue<F extends SpecField> = SpecSnapshot[F];

/** Discriminated union keyed by `field`: narrowing on `field` narrows before/after. */
export type SpecFieldChange = {
  [F in SpecField]: {
    readonly field: F;
    readonly kind: "ADDED" | "REMOVED" | "CHANGED"; // null→value | value→null | value→value
    readonly before: SpecValue<F>;
    readonly after: SpecValue<F>;
  };
}[SpecField];

export function diffSpecSnapshots(before: SpecSnapshot, after: SpecSnapshot): readonly SpecFieldChange[];
export function toSpecSnapshot(row: SpecColumns): SpecSnapshot;      // Prisma row → normalized
export function mergeSpecPatch(base: SpecSnapshot, patch: SpecPatch): SpecSnapshot;
```

**Rules**:

- It is pure: no I/O, no `Date.now()`, and no mutation of inputs.
- The output is in `SPEC_FIELDS` order, and only differing fields are included (FR-019).
- `widthValue`/`heightValue` are normalized by `toSpecSnapshot`/`mergeSpecPatch` to canonical
  decimal strings (`new Prisma.Decimal(v).toString()`), so `"1.50"` and `1.5` compare equal
  (US4-3).
- For strings, `""` and whitespace-only are normalized to `null`. The comparison is exact
  otherwise, with no case-folding.
- `diffSpecSnapshots(x, x)` returns `[]`. It is used for the `NO_CHANGES` refusal and for
  `SpecChangedEvent.changedFields`.

**Unit test table** (tests/unit/changes/diff.test.ts):

- Quantity only (US4-1).
- Null → value (US4-2).
- 1.50 vs 1.5 (US4-3).
- Value → null.
- A multi-field change, checking the order.
- Identical snapshots.
- `productTypeId` change.
- `dimensionUnit` change.

## `<SpecDiff>` (`src/components/changes/spec-diff.tsx`)

```ts
export type SpecDiffProps = {
  changes: readonly SpecFieldChange[];
  /** productTypeId → display name; resolved by the page in one query, never inside the component. */
  productTypeNames?: Readonly<Record<string, string>>;
  /** Shown when changes is empty. Defaults to ar.json "changes.diff.none". */
  emptyLabel?: string;
  /** Optional caption, e.g. "v1 → v2" or "الحالي → المقترح". */
  caption?: string;
};
export function SpecDiff(props: SpecDiffProps): JSX.Element;
```

- It is a Server Component with no hooks and no client JS. It is presentational only and does no
  data fetching.
- It renders a `<table>` (`dir` inherited RTL) with rows of `label | before | → | after`.
  - `null` renders as "—".
  - Field labels come from `ar.json` (`changes.fields.<field>`).
  - `dimensionUnit` values come from new `changes.dimensionUnit.{MM,CM,M,IN}` keys. `ar.json` has
    only a `dimensionUnitLabel` today, with no per-unit labels.
  - Numbers use `Intl.NumberFormat("ar-EG")`.
- Rows are marked with `data-field` and `data-kind` for tests.
- Layout uses logical CSS properties only (`ps-*`, `pe-*`, `text-start`).
- It is exported via `src/components/changes/index.ts`.

**Render test** (`tests/unit/changes/spec-diff-render.test.ts`, a `.ts` file per vitest's include
glob): `renderToStaticMarkup(SpecDiff({ changes }))` is called directly as a function, avoiding
JSX in a `.ts` file. It asserts:

- One row per change, with the correct `data-field`.
- "—" for null.
- The empty label when there are no changes.

## Where it is used (FR-020)

| Screen | Compared | Data source |
|---|---|---|
| Order detail → Work Item history (`spec-history.tsx`) | each consecutive pair, plus any two chosen versions | `getSpecHistory`, `getSpecVersionDiff` |
| Change request detail (`/changes/[id]`) | base version vs base + proposed patch | `getChangeRequestDetail` |
| Production job card (`/production/[workItemId]`) | version at production start vs current | `getJobCard().productionStartDiff` |
