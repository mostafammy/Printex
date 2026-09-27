// src/server/core/aspects/actor.ts
// Actor conversion helper for shared aspects engine and transition.

import type { Actor as CoreActor } from "../actor";
import { asUserId } from "../ids";

function readStringArray(o: object, k: string): readonly string[] {
  const v: unknown = Reflect.get(o, k);
  return Array.isArray(v) && v.every((x): x is string => typeof x === "string") ? v : [];
}

export function toCoreActor(a: { readonly userId: string }): CoreActor {
  return {
    userId: asUserId(a.userId),
    roles: readStringArray(a, "roles"),
    departmentIds: readStringArray(a, "departmentIds"),
  };
}
