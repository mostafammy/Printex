// src/server/aspects.ts — Composition root for shared aspect-oriented commands/queries.
// Wires database, 001 identity & access authorize/audit, Actor and Permission into createAspects.
// contracts/aspects.md §4 (specs/016-change-control/contracts/aspects.md).

import { createAspects } from "~/server/core";
import { authorize, audit, type Actor, type Permission } from "~/server/auth";
import { db } from "~/server/db";

export const aspects = createAspects<Actor, Permission>({
  transaction: (fn, opts) => db.$transaction(fn, opts),
  reader: db,
  checkPermission: (actor, p, scope) => authorize(actor, p, scope),
  isForbidden: (e) => e instanceof Error && e.name === "ForbiddenError",
  recordAudit: (tx, e) =>
    audit.record(tx, {
      ...e,
      attachmentIds: e.attachmentIds ? [...e.attachmentIds] : undefined,
    }),
  onAfterCommitError: (e, meta) =>
    console.error("[aspects] afterCommit failed", meta.action, e),
});
