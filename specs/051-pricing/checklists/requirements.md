# Specification Quality Checklist: Pricing Engine

**Purpose**: Validate specification completeness and quality before planning implementation.
**Created**: 2026-09-24
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details in the normative business requirements.
- [x] Focused on pricing value, authority, history, and delivery protection.
- [x] Written for operational and technical stakeholders.
- [x] Mandatory sections are complete.

## Requirement Completeness

- [x] No unresolved `[NEEDS CLARIFICATION]` markers remain.
- [x] Requirements are testable and unambiguous.
- [x] Success criteria are measurable and scenario-based.
- [x] Success criteria do not require a particular UI framework or implementation.
- [x] Acceptance scenarios cover fixed, variable, customer-specific, queue, delivery, reset, and return paths.
- [x] Edge cases cover units, dimensions, tiers, dates, rounding, reprints, disputes, and urgent work.
- [x] Scope is bounded by explicit out-of-scope items.
- [x] Dependencies and assumptions are identified.

## Cross-Contract Readiness

- [x] ProductType ownership is assigned to 011.
- [x] Customer profile extension is assigned to 010.
- [x] Delivery gate uses 015's PricingGatePort rather than a duplicate guard.
- [x] Specification-change reset uses 016's transactional listener.
- [x] Pricing returns reuse 013's Return model.
- [x] Authorization and audit use 001 contracts.

## Acceptance Coverage

- [x] Customer ABC receives 90 EGP/m, other customers receive 100 EGP/m, and expired rules are ignored.
- [x] Tier boundaries 9, 10, and 50 are specified.
- [x] Reception cannot set VARIABLE prices.
- [x] Delivery with one PENDING item fails with `PRICING_UNRESOLVED`.
- [x] Production can start while pricing is PENDING.
- [x] Every price change leaves history and audit.

## Notes

- Real commercial rates and top-product units remain owner data to collect before implementation.
- Shared database operations and availability of 015/016 are implementation blockers and belong in tasks.
