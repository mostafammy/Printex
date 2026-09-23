# Customer Service Contract

These operations are server-authoritative. Each fallible operation validates input, authenticates the caller, checks `authorize('customer.manage')`, and returns the repository's typed action/result shape. Mutations are atomic with their audit event.

## `normalizePhone(raw)`

- **Input**: raw string.
- **Output**: canonical Egyptian E.164 string, e.g. `+201012345678`, or validation error.
- **Accepted forms**: `01xxxxxxxxx`, `+201xxxxxxxxx`, `00201...`, with spaces/dashes.
- **Behavior**: strip permitted separators, convert local prefix to `+20`, validate Egyptian mobile length/prefix, never persist raw-only values.

## `findCustomers(query)`

- **Input**: `{ text: string; includeArchived?: boolean; limit?: number }`.
- **Output**: bounded result list containing `customerId`, display name, matching phone(s), classification, archived state, and Cash Customer marker.
- **Behavior**: phone matching first (full/partial, any stored phone), name fallback using Arabic normalized search. Archived records excluded unless authorized history context requests them. Enforce a bounded limit and reject/short-circuit too-short empty queries.
- **Performance**: representative 50,000-customer phone searches meet the spec target: under 300 ms for at least 95% of searches.

## `getCustomer(id)`

- **Input**: Customer ID plus authorized context.
- **Output**: profile data: overview, phones, addresses, classification, notes, active/completed orders, archive state, and extension slots for 051/052/054.
- **Behavior**: preserves Cash Customer visibility for order history; respects record scope and archived-history authorization.

## `createCustomer(input)`

- **Input**: `{ name; primaryPhone; alternatePhones?; nationalId?; addresses?; notes?; classificationId? }`.
- **Output**: created Customer ID/profile summary.
- **Validation**: name and one valid primary phone required; all phones normalized and unique.
- **Duplicate behavior**: existing phone returns the existing customer reference and a duplicate error; creation is hard-blocked.
- **Audit**: creation records the new customer values through the audit mechanism; no partial record on failure.

## Customer update/archive

- Reception may edit all customer fields except archive and promotion.
- Archive is Admin-only, hides the customer from default search, preserves history, and writes an audit event.
- Cash Customer rejects update, rename, archive, and merge attempts server-side.
- No hard delete or merge operation exists in V1.

## Promotion

- Creates a real target customer from supplied required details.
- Accepts an explicit list of selected Cash Customer Order IDs.
- Re-links only selected orders in one audited operation.
- Admin can reverse the promotion; reversal is itself audited and conflict-checked. It succeeds only if every selected Order still belongs to the promoted customer; otherwise the entire reversal is rejected and no Order changes.
