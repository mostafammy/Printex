// Types for shared aspect-oriented command/query layer.
// contracts/aspects.md §2 (specs/016-change-control/contracts/aspects.md).
//
// Hexagonal domain types: framework-agnostic, zero runtime overhead.
// Imports only generated Prisma types, zod, and core internals. Rule (a) enforced:
// must NOT import ~/server/auth, ~/server/db, or any feature.

import type { Prisma } from "../../../../generated/prisma";
import type { z } from "zod";
import type { Actor as CoreActor } from "../actor";
import type { WorkItemState } from "../workflow/states";
import type { TransitionOrThrowInput, TransitionOutcome } from "./transition";
import type { TxOptions } from "./txOptions";

export type Tx = Prisma.TransactionClient;

/** Codes every module inherits. A module's own union is added on top of these. */
export type AspectBaseError =
  | { readonly code: "VALIDATION"; readonly issues: readonly { path: string; message: string }[] }
  | { readonly code: "FORBIDDEN" }
  | { readonly code: "NOT_FOUND"; readonly entity: string; readonly id: string }
  | { readonly code: "CONFLICT"; readonly entity: string; readonly id: string }
  | {
      readonly code: "INVALID_STATE";
      readonly workItemIds: readonly string[];
      readonly expected: readonly WorkItemState[];
    }
  | { readonly code: "GUARD_FAILED"; readonly guardCode: string; readonly message: string };

export type ModuleErrorShape = { readonly code: string };

export type MapUniqueViolation<E extends ModuleErrorShape = ModuleErrorShape> = (
  target: readonly string[],
  modelName: string | undefined,
) => E | undefined;

export interface ModuleBindingOptions<E extends ModuleErrorShape = ModuleErrorShape> {
  /** Module name, used in misuse errors and logs. */
  readonly module: string;
  /** Maps a transitionWorkItem GUARD_FAILED guardCode to a module error. undefined → base GUARD_FAILED. */
  readonly mapGuardFailure?: (guardCode: string, details: unknown) => E | undefined;
  /** Maps a Prisma P2002 unique violation to a module error. undefined → base CONFLICT. */
  readonly mapUniqueViolation?: MapUniqueViolation<E>;
}

export type AspectResult<T, E extends ModuleErrorShape> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: AspectBaseError | E };

/** A single key, a non-empty any-of list, or a PURE function of the validated input (no I/O). */
export type PermissionSpec<P extends string, I> =
  | P
  | readonly [P, ...P[]]
  | ((input: I) => P | readonly [P, ...P[]]);

export interface AuditEntry {
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason?: string;
  readonly attachmentIds?: readonly string[];
}

export type RunOutcome<O> =
  | { readonly value: O; readonly audit: readonly [AuditEntry, ...AuditEntry[]] }
  | { readonly value: O; readonly noChange: true }; // type-checked: only when allowNoChange: true

export interface TxScope {
  readonly tx: Tx;
  /** Registers a hook that runs after the OUTERMOST transaction commits. */
  readonly afterCommit: (hook: () => Promise<void>) => void;
}

export interface CommandCtx<A, P extends string, I, Prep> extends TxScope {
  readonly actor: A;
  readonly coreActor: CoreActor; // branded UserId, built once via asUserId
  readonly input: I;
  readonly prepared: Prep; // value returned by `prepare`, or undefined
  /** Scoped permission check, for example a department scope, after an entity is loaded. Throws Forbidden. */
  readonly check: (permission: P, scope?: { departmentId?: string }) => void;
  /** transitionOrThrow with tx and actor pre-bound (§3.3). */
  readonly transition: (i: Omit<TransitionOrThrowInput, "actor">) => Promise<TransitionOutcome>;
}

export interface AspectDeps<A extends { userId: string }, P extends string> {
  /** db.$transaction(fn, opts). */
  readonly transaction: <T>(
    fn: (tx: Tx) => Promise<T>,
    opts?: TxOptions,
  ) => Promise<T>;
  /** Read client that queries use outside a transaction (the db instance). */
  readonly reader: Tx;
  /** 001 authorize(): returns on success, throws on denial. */
  readonly checkPermission: (actor: A, permission: P, scope?: { departmentId?: string }) => void;
  /** Recognises the denial error. 001 does not export ForbiddenError, so the match is on `name`. */
  readonly isForbidden: (e: unknown) => boolean;
  /** 001 audit.record(). actorId is always taken from the actor, never from the entry. */
  readonly recordAudit: (tx: Tx, entry: AuditEntry & { actorId: string }) => Promise<void>;
  /** An afterCommit hook failed. The data is already committed, so the result stays ok. */
  readonly onAfterCommitError: (e: unknown, meta: { action: string }) => void;
}

export type DefineCommand<A, P extends string, E extends ModuleErrorShape> = <
  S extends z.ZodType<unknown, z.ZodTypeDef, unknown>,
  O,
  Prep = undefined,
  NoChange extends boolean = false,
>(def: {
  readonly action: string; // audit action prefix, used in logs
  readonly input: S;
  readonly permission: PermissionSpec<P, z.output<S>>;
  readonly prepare?: (c: { actor: A; input: z.output<S> }) => Promise<Prep>;
  readonly authorize?: (c: CommandCtx<A, P, z.output<S>, Prep>) => Promise<void> | void;
  readonly run: (c: CommandCtx<A, P, z.output<S>, Prep>) => Promise<
    NoChange extends true
      ? RunOutcome<O>
      : { readonly value: O; readonly audit: readonly [AuditEntry, ...AuditEntry[]] }
  >;
  readonly allowNoChange?: NoChange;
  readonly txOptions?: TxOptions;
}) => {
  /** Public entry point. It never throws a domain error. It re-throws only programming or infrastructure errors. */
  (actor: A, raw: z.input<S>): Promise<AspectResult<O, E>>;
  /** Composition inside a caller's transaction. It throws AspectDomainError<E> so the caller rolls back.
   *  Exists only when the command has no `prepare` (conditional type), because pre-transaction I/O cannot run
   *  inside someone else's transaction. */
  inTx: [Prep] extends [undefined] ? (scope: TxScope, actor: A, raw: z.input<S>) => Promise<O> : never;
};

export type DefineQuery<A, P extends string, E extends ModuleErrorShape> = <
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
  /** true → run inside a read transaction for a consistent snapshot. */
  readonly consistent?: boolean;
}) => (actor: A, raw: z.input<S>) => Promise<AspectResult<O, E>>;
