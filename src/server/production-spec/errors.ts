// errors.ts — re-export of the shared error vocabulary.
//
// The class itself moved to `src/lib/production/errors.ts` because the
// reception row raises and reads these codes while the receptionist types, and
// it must not depend on a database module. This re-export keeps
// `~/server/production-spec/errors` — and therefore the module's public surface
// and every existing import of it — pointing at the SAME class, so
// `instanceof DomainProductionSpecError` still holds across the boundary.

export * from "~/lib/production/errors";
