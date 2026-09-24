# Contract: Authorization and Audit

## Permission matrix

| Operation | Required permission | Notes |
|---|---|---|
| Apply computed FIXED quote | `pricing.use_fixed` | Reception may use this; no manual amount accepted. |
| Set VARIABLE price | `pricing.set_variable` | Requires positive Decimal amount and reason. |
| Override computed/customer price | `pricing.override` | Requires reason; source becomes MANUAL. |
| View pricing queue/panel | `pricing.use_fixed` or a configured pricing-view permission | Server-side check; UI visibility is not authority. |
| Manage price lists/rules | `admin.config` plus pricing authorization | Exact role assignment remains 001 configuration. |
| Record pricing return | Pricing action permission plus authenticated actor | Uses 013 transaction helper. |

Existing permission names in 001 are authoritative. If a new view/manage permission is needed, it must be added through 001 rather than invented locally.

## Transaction ordering

1. Authenticate actor.
2. Validate input and load the current WorkItem/specification.
3. Call `authorize(actor, permission)`.
4. Resolve quote or validate manual amount/reason.
5. Append WorkItemPrice and update PricingStatus.
6. Call `audit.record(tx, ...)` with old/new status, amount, source, and reason.
7. Commit; return the snapshot.

Audit failure rejects the transaction. No UI-only mutation or best-effort audit is permitted.

## Required audit actions

`pricing.quoted`, `pricing.price_set`, `pricing.price_overridden`, `pricing.status_changed`, `pricing.reset_after_spec_change`, `pricing.rule_created`, `pricing.rule_retired`, `pricing.price_list_created`, and `pricing.return_recorded`.

Each event includes actor, timestamp, WorkItem/configuration ID, previous/current status or values, source, and reason where applicable.
