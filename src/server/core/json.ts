// Shared JSON-compatible type for Prisma `Json` fields.
//
// Prisma's `Json` columns (e.g. WorkItemTransition.meta, NotificationEvent.payload)
// should be typed with a proper recursive JSON type in application code, not
// a bare `Record<string, unknown>` (which disallows arrays/primitives at the
// top level and doesn't recurse). Use `JsonValue` wherever a `Json?` field is
// modeled in TypeScript.

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
