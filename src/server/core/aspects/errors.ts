// Aspect engine error types and centralized mapping table.
// contracts/aspects.md §3.2 (specs/016-change-control/contracts/aspects.md).
//
// Single place where errors are converted from internal domain errors, Zod validation,
// authorization denials, transition failures, and database errors to the public
// AspectBaseError | E union.
//
// ESLint rule (c) exemption: src/server/core/aspects/** is permitted to throw internally
// because transaction rollback requires rejections. Public entry points catch all
// domain failures and return AspectResult<T, E>.

import { z } from "zod";
import type { DomainError } from "../errors";
import type { AspectBaseError, ModuleErrorShape } from "./types";

/**
 * Thrown internally to abort a transaction and return a typed domain failure.
 * Never leaks past the public command/query boundary.
 */
export class AspectDomainError<E extends ModuleErrorShape> extends Error {
  readonly error: AspectBaseError | E;

  constructor(error: AspectBaseError | E) {
    super(error.code);
    this.name = "AspectDomainError";
    this.error = error;
  }
}

/**
 * Convenience helper to abort the current command/query with a typed domain error.
 * Causes interactive transactions to cleanly roll back.
 */
export const fail = <E extends ModuleErrorShape>(error: AspectBaseError | E): never => {
  throw new AspectDomainError(error);
};

/**
 * Thrown by `transitionOrThrow` when `transitionWorkItem` returns a DomainError.
 * Caught by `mapAspectError` and translated according to §3.2.
 */
export class TransitionFailure extends Error {
  readonly workItemId: string;
  readonly error: DomainError;

  constructor(workItemId: string, error: DomainError) {
    super(error.code);
    this.name = "TransitionFailure";
    this.workItemId = workItemId;
    this.error = error;
  }
}

/**
 * Indicates a programming error or contract violation in command definition
 * (e.g. empty audit list, returning noChange without allowNoChange).
 * Always re-thrown and never converted to a domain error.
 */
export class AspectMisuseError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "AspectMisuseError";
  }
}

export interface ErrorMappingOptions<E extends ModuleErrorShape> {
  readonly mapGuardFailure?: (guardCode: string, details: unknown) => E | undefined;
  readonly mapUniqueViolation?: (target: readonly string[]) => E | undefined;
}

/**
 * Centralized error mapping function (contracts/aspects.md §3.2).
 * Converts caught exceptions into typed `AspectBaseError | E` representations.
 *
 * Unknown infrastructure/programming errors and AspectMisuseError are re-thrown.
 */
export function mapAspectError<E extends ModuleErrorShape>(
  caught: unknown,
  opts: ErrorMappingOptions<E>,
  isForbidden: (e: unknown) => boolean,
): AspectBaseError | E {
  // 1. ZodError → VALIDATION { issues }
  if (caught instanceof z.ZodError) {
    const issues = caught.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return {
      code: "VALIDATION",
      issues,
    };
  }

  // 2. deps.isForbidden(e) → FORBIDDEN
  if (isForbidden(caught)) {
    return { code: "FORBIDDEN" };
  }

  // 3. AspectDomainError<E> (module-raised via fail()) → e.error
  if (caught instanceof AspectDomainError) {
    return caught.error as AspectBaseError | E;
  }

  // 4-7. TransitionFailure mappings
  if (caught instanceof TransitionFailure) {
    const { workItemId, error } = caught;

    // TransitionFailure whose error.code is VALIDATION
    if (error.code === "VALIDATION") {
      return {
        code: "VALIDATION",
        issues: [{ path: "", message: error.message }],
      };
    }

    // TransitionFailure with INVALID_TRANSITION
    if (error.code === "INVALID_TRANSITION") {
      const details = error.details;
      const hasExpectedFrom =
        typeof details === "object" &&
        details !== null &&
        "expectedFrom" in details &&
        (details as { expectedFrom?: unknown }).expectedFrom !== undefined;

      if (hasExpectedFrom) {
        // Optimistic-concurrency miss
        return {
          code: "CONFLICT",
          entity: "WorkItem",
          id: workItemId,
        };
      }

      // Plain invalid state transition
      return {
        code: "INVALID_STATE",
        workItemIds: [workItemId],
        expected: [],
      };
    }

    // TransitionFailure with GUARD_FAILED
    if (error.code === "GUARD_FAILED") {
      const details = error.details;
      const guardCode =
        typeof details === "object" && details !== null && "guardCode" in details
          ? String(details.guardCode)
          : "";

      const mapped = opts.mapGuardFailure?.(guardCode, details);
      if (mapped) {
        return mapped;
      }

      return {
        code: "GUARD_FAILED",
        guardCode,
        message: error.message,
      };
    }

    // Any unexpected transition error is treated as an unhandled error and re-thrown below
  }

  // 8. Prisma error with code === "P2002" (checked structurally per contract)
  if (isPrismaP2002(caught)) {
    const rawTarget = caught.meta?.target;
    const target: readonly string[] = Array.isArray(rawTarget)
      ? rawTarget.map((item) => String(item))
      : typeof rawTarget === "string"
        ? [rawTarget]
        : [];

    const mapped = opts.mapUniqueViolation?.(target);
    if (mapped) {
      return mapped;
    }

    const modelName =
      typeof caught.meta?.modelName === "string" ? caught.meta.modelName : "";

    return {
      code: "CONFLICT",
      entity: modelName,
      id: "",
    };
  }

  // 9. AspectMisuseError or anything else: re-throw!
  throw caught;
}

/**
 * Structural check for Prisma P2002 unique constraint violations.
 * Avoids direct value imports of Prisma client runtime into core (rule (a)).
 */
function isPrismaP2002(
  e: unknown,
): e is {
  code: "P2002";
  meta?: { target?: unknown; modelName?: unknown };
} {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    e.code === "P2002"
  );
}
