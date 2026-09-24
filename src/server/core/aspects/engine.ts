// Generic aspect engine: createAspects(deps).forModule<E>(binding).
// contracts/aspects.md §3, §3.1 (specs/016-change-control/contracts/aspects.md).
//
// Provides a fixed, unconfigurable execution pipeline for commands and queries:
// 1. Validate raw input with Zod
// 2. Permission check (pure, no I/O)
// 3. Prepare (optional pre-transaction I/O)
// 4. Open transaction with txOptions
// 5. Authorize (entity-scoped checks inside same tx)
// 6. Run business logic
// 7. Record audit entries
// 8. Commit
// 9. afterCommit hooks (registration order)
// 10. Map errors to public AspectResult<O, E>

import type { Prisma } from "../../../../generated/prisma";
import type { z } from "zod";
import type { Actor as CoreActor } from "../actor";
import type {
  AspectDeps,
  AspectResult,
  AuditEntry,
  CommandCtx,
  DefineCommand,
  DefineQuery,
  ModuleBindingOptions,
  ModuleErrorShape,
  PermissionSpec,
  Tx,
  TxScope,
} from "./types";
import {
  AspectDomainError,
  AspectMisuseError,
  mapAspectError,
} from "./errors";
import { transitionOrThrow } from "./transition";
import { toCoreActor } from "./actor";

type RunOutcome<O, NoChange extends boolean> = NoChange extends true
  ?
      | { readonly value: O; readonly audit: readonly [AuditEntry, ...AuditEntry[]] }
      | { readonly value: O; readonly noChange: true }
  : { readonly value: O; readonly audit: readonly [AuditEntry, ...AuditEntry[]] };

function toPermissionList<P extends string>(
  resolved: P | readonly [P, ...P[]],
): readonly P[] {
  if (typeof resolved === "string") {
    return [resolved];
  }
  return resolved;
}

/**
 * Evaluates a static PermissionSpec (contracts/aspects.md §3.1 step 2).
 * Supports single permission string, any-of array, or pure resolver function.
 * Throws AspectDomainError({ code: "FORBIDDEN" }) if no permission is granted.
 */
function checkStaticPermission<A extends { userId: string }, P extends string, I>(
  deps: AspectDeps<A, P>,
  actor: A,
  spec: PermissionSpec<P, I>,
  input: I,
): void {
  const resolved = typeof spec === "function" ? spec(input) : spec;
  const permissions = toPermissionList(resolved);

  let granted = false;
  for (const perm of permissions) {
    try {
      deps.checkPermission(actor, perm);
      granted = true;
      break;
    } catch (e) {
      if (!deps.isForbidden(e)) throw e;
      // Permission denied for this key; try remaining any-of keys.
    }
  }

  if (!granted) {
    throw new AspectDomainError({ code: "FORBIDDEN" });
  }
}

/**
 * Validates and records audit entries within the transaction (contracts/aspects.md §3.1 step 7).
 * actorId is always taken from the actor, never from the entry.
 */
async function recordAuditEntries<A extends { userId: string }>(
  recordAudit: (tx: Tx, entry: AuditEntry & { actorId: string }) => Promise<void>,
  tx: Tx,
  actor: A,
  outcome: { readonly audit?: readonly AuditEntry[]; readonly noChange?: boolean },
  allowNoChange?: boolean,
): Promise<void> {
  if (outcome.noChange === true) {
    if (!allowNoChange) {
      throw new AspectMisuseError(
        "Command outcome returned noChange: true, but allowNoChange was not enabled on defineCommand",
      );
    }
    return;
  }

  if (!outcome.audit || outcome.audit.length === 0) {
    throw new AspectMisuseError(
      "Command outcome must include at least one AuditEntry unless allowNoChange: true is returned",
    );
  }

  for (const entry of outcome.audit) {
    await recordAudit(tx, {
      ...entry,
      actorId: actor.userId,
    });
  }
}

type CommandTarget<
  A,
  S extends z.ZodType<unknown, z.ZodTypeDef, unknown>,
  O,
  E extends ModuleErrorShape,
  Prep,
> = {
  (actor: A, raw: z.input<S>): Promise<AspectResult<O, E>>;
  inTx: [Prep] extends [undefined] ? (scope: TxScope, actor: A, raw: z.input<S>) => Promise<O> : never;
};

/**
 * Creates the generic aspect engine bound to the provided cross-cutting infrastructure dependencies.
 */
export function createAspects<A extends { userId: string }, P extends string>(
  deps: AspectDeps<A, P>,
): {
  forModule<E extends ModuleErrorShape>(opts: ModuleBindingOptions<E>): {
    defineCommand: DefineCommand<A, P, E>;
    defineQuery: DefineQuery<A, P, E>;
  };
} {
  return {
    forModule<E extends ModuleErrorShape>(opts: ModuleBindingOptions<E>) {
      const defineCommand: DefineCommand<A, P, E> = <
        S extends z.ZodType<unknown, z.ZodTypeDef, unknown>,
        O,
        Prep = undefined,
        NoChange extends boolean = false,
      >(def: {
        readonly action: string;
        readonly input: S;
        readonly permission: PermissionSpec<P, z.output<S>>;
        readonly prepare?: (c: { actor: A; input: z.output<S> }) => Promise<Prep>;
        readonly authorize?: (c: CommandCtx<A, P, z.output<S>, Prep>) => Promise<void> | void;
        readonly run: (c: CommandCtx<A, P, z.output<S>, Prep>) => Promise<RunOutcome<O, NoChange>>;
        readonly allowNoChange?: NoChange;
        readonly txOptions?: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel };
      }) => {
        // Public entry point — catches domain errors and maps to AspectResult<O, E>
        const execute = async (actor: A, raw: z.input<S>): Promise<AspectResult<O, E>> => {
          try {
            // 1. Validate raw input with Zod (pure, no I/O)
            const parsedInput = def.input.parse(raw);

            // 2. Static permission check (no I/O)
            checkStaticPermission(deps, actor, def.permission, parsedInput);

            // 3. Prepare (pre-transaction I/O) — runs only after static permission passes
            // Unavoidable cast: TS cannot narrow Prep to undefined when def.prepare is omitted.
            const prepared = def.prepare
              ? await def.prepare({ actor, input: parsedInput })
              : (undefined as Prep);

            const afterCommitHooks: (() => Promise<void>)[] = [];
            let closed = false;

            // 4. Open transaction with txOptions
            let outcome: RunOutcome<O, NoChange>;
            try {
              outcome = await deps.transaction(async (tx) => {
                const ctx: CommandCtx<A, P, z.output<S>, Prep> = {
                  tx,
                  afterCommit: (hook) => {
                    if (closed) {
                      throw new AspectMisuseError(
                        "Cannot register afterCommit hook after transaction has settled",
                      );
                    }
                    afterCommitHooks.push(hook);
                  },
                  actor,
                  coreActor: toCoreActor(actor),
                  input: parsedInput,
                  prepared,
                  check: (permission, scope) => deps.checkPermission(actor, permission, scope),
                  transition: (i) => transitionOrThrow(tx, { ...i, actor }),
                };

                // 5. Authorize hook (entity-scoped checks inside same tx)
                if (def.authorize) {
                  await def.authorize(ctx);
                }

                // 6. Run command logic
                const runOutcome = await def.run(ctx);

                // 7. Audit recording in same tx
                await recordAuditEntries(
                  deps.recordAudit,
                  tx,
                  actor,
                  runOutcome,
                  def.allowNoChange,
                );

                return runOutcome;
              }, def.txOptions);
            } finally {
              closed = true;
            }

            // 8. Commit: transaction has completed successfully here

            // 9. afterCommit hooks run sequentially
            for (const hook of afterCommitHooks) {
              try {
                await hook();
              } catch (hookError) {
                try {
                  deps.onAfterCommitError(hookError, { action: def.action });
                } catch {
                  // The reporter must not affect a committed result
                }
              }
            }

            return { ok: true, data: outcome.value };
          } catch (caught) {
            // 10. Map errors — re-throws unknown or misuse errors
            const mapped = mapAspectError(caught, opts, deps.isForbidden);
            return { ok: false, error: mapped };
          }
        };

        // Composition inside a caller's transaction
        const inTxFn = async (scope: TxScope, actor: A, raw: z.input<S>): Promise<O> => {
          if (def.prepare !== undefined) {
            throw new AspectMisuseError(
              `Command '${def.action}' has a prepare hook and cannot be run inside an existing transaction (.inTx)`,
            );
          }

          try {
            // 1. Validate raw input with Zod
            const parsedInput = def.input.parse(raw);

            // 2. Static permission check
            checkStaticPermission(deps, actor, def.permission, parsedInput);

            const ctx: CommandCtx<A, P, z.output<S>, Prep> = {
              tx: scope.tx,
              afterCommit: scope.afterCommit,
              actor,
              coreActor: toCoreActor(actor),
              input: parsedInput,
              // Unavoidable cast: inTx disallows prepare so Prep is always undefined, but CommandCtx requires Prep.
              prepared: undefined as Prep,
              check: (permission, scopeParams) =>
                deps.checkPermission(actor, permission, scopeParams),
              transition: (i) => transitionOrThrow(scope.tx, { ...i, actor }),
            };

            // 5. Authorize hook
            if (def.authorize) {
              await def.authorize(ctx);
            }

            // 6. Run command logic
            const runOutcome = await def.run(ctx);

            // 7. Audit recording in caller's tx
            await recordAuditEntries(
              deps.recordAudit,
              scope.tx,
              actor,
              runOutcome,
              def.allowNoChange,
            );

            return runOutcome.value;
          } catch (caught) {
            // Re-throw AspectDomainError or map and throw AspectDomainError so outer tx rolls back
            if (caught instanceof AspectDomainError) {
              throw caught;
            }
            const mapped = mapAspectError(caught, opts, deps.isForbidden);
            throw new AspectDomainError(mapped);
          }
        };

        // Attach inTx function to the command closure
        const commandWithInTx = Object.assign(execute, { inTx: inTxFn });
        // Unavoidable cast: Object.assign cannot infer the conditional inTx type on CommandTarget.
        return commandWithInTx as CommandTarget<A, S, O, E, Prep>;
      };

      const defineQuery: DefineQuery<A, P, E> = <
        S extends z.ZodType<unknown, z.ZodTypeDef, unknown>,
        O,
      >(def: {
        readonly input: S;
        readonly permission: PermissionSpec<P, z.output<S>>;
        readonly authorize?: (c: {
          client: Tx;
          actor: A;
          input: z.output<S>;
          check: (p: P, scope?: { departmentId?: string }) => void;
        }) => Promise<void> | void;
        readonly run: (c: {
          client: Tx;
          actor: A;
          coreActor: CoreActor;
          input: z.output<S>;
        }) => Promise<O>;
        readonly consistent?: boolean;
      }) => {
        return async (actor: A, raw: z.input<S>): Promise<AspectResult<O, E>> => {
          try {
            // 1. Validate raw input with Zod
            const parsedInput = def.input.parse(raw);

            // 2. Static permission check
            checkStaticPermission(deps, actor, def.permission, parsedInput);

            const executeQuery = async (client: Tx): Promise<O> => {
              // 3. Authorize hook (if provided)
              if (def.authorize) {
                await def.authorize({
                  client,
                  actor,
                  input: parsedInput,
                  check: (permission, scope) => deps.checkPermission(actor, permission, scope),
                });
              }

              // 4. Run query
              return def.run({
                client,
                actor,
                coreActor: toCoreActor(actor),
                input: parsedInput,
              });
            };

            let result: O;
            if (def.consistent) {
              result = await deps.transaction(executeQuery, { isolationLevel: "RepeatableRead" });
            } else {
              result = await executeQuery(deps.reader);
            }

            return { ok: true, data: result };
          } catch (caught) {
            const mapped = mapAspectError(caught, opts, deps.isForbidden);
            return { ok: false, error: mapped };
          }
        };
      };

      return {
        defineCommand,
        defineQuery,
      };
    },
  };
}

export type { DefineCommand, DefineQuery };
