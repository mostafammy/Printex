/**
 * Move dispatcher: executes card transitions via domain actions with full error mapping.
 * (contracts/board-server.md §moveWorkItem, plan.md S1)
 */

import { ZodError } from "zod";
import type { BoardCard, MoveRequest, MoveResult } from "~/lib/board/types";
import type { Actor } from "~/server/auth";
import { ForbiddenError } from "~/server/auth/authorize";
import { db } from "~/server/db";
import type { EdgeHandler } from "./edgeCatalog";
import { edgeCatalog } from "./edges";
import { getRefusalMessageAr } from "./messages";
import { getBoardCards } from "./snapshot";

const STALE_ERROR_CODES = new Set(["INVALID_TRANSITION", "NOT_ASSIGNABLE"]);
const GUARD_ERROR_CODES = new Set(["GUARD_FAILED", "DESIGN_REQUIRED"]);

interface ExecutionContext {
  readonly handler: EdgeHandler;
  readonly actor: Actor;
  readonly card: BoardCard;
  readonly req: MoveRequest;
  readonly prismaClient?: typeof db;
}

function isStaleStateError(code: string | undefined): boolean {
  return typeof code === "string" && STALE_ERROR_CODES.has(code);
}

function isGuardError(name: string | undefined, code: string | undefined): boolean {
  if (name === "SelfReviewForbiddenError") return true;
  return typeof code === "string" && GUARD_ERROR_CODES.has(code);
}

function mapDomainError(
  err: { code?: string; message?: string; name?: string; error?: { code?: string } },
  card: BoardCard,
): MoveResult {
  const code = err.code ?? err.error?.code;
  if (isStaleStateError(code)) {
    return { ok: false, code: "STALE_STATE", messageAr: getRefusalMessageAr("STALE_STATE"), card };
  }
  if (isGuardError(err.name, code)) {
    return { ok: false, code: "GUARD_FAILED", messageAr: getRefusalMessageAr("GUARD_FAILED", err.message), card };
  }
  if (err.message && err.name?.startsWith("Domain")) {
    return { ok: false, code: "GUARD_FAILED", messageAr: err.message, card };
  }
  return { ok: false, code: "INTERNAL", messageAr: getRefusalMessageAr("INTERNAL"), card };
}

function mapErrorToRefusal(error: unknown, card: BoardCard): MoveResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, code: "FORBIDDEN", messageAr: getRefusalMessageAr("FORBIDDEN"), card };
  }
  if (error instanceof ZodError) {
    return { ok: false, code: "VALIDATION", messageAr: getRefusalMessageAr("VALIDATION"), card };
  }
  return mapDomainError(error as { code?: string; message?: string; name?: string }, card);
}

function checkStaticEligibility(handler: EdgeHandler, card: BoardCard): MoveResult | null {
  if (!handler.edgeId.startsWith(`${card.state}->`)) {
    return { ok: false, code: "STALE_STATE", messageAr: getRefusalMessageAr("STALE_STATE"), card };
  }
  if (handler.kind === "SYSTEM") {
    return { ok: false, code: "NOT_OFFERED", messageAr: getRefusalMessageAr("NOT_OFFERED"), card };
  }
  return null;
}

function checkPermissions(handler: EdgeHandler, actor: Actor, card: BoardCard): MoveResult | null {
  if (handler.permission && !actor.permissions.has(handler.permission)) {
    return { ok: false, code: "FORBIDDEN", messageAr: getRefusalMessageAr("FORBIDDEN"), card };
  }
  if (handler.departmentScoped && card.departmentId && !actor.departmentIds.includes(card.departmentId)) {
    return { ok: false, code: "FORBIDDEN", messageAr: getRefusalMessageAr("FORBIDDEN"), card };
  }
  return null;
}

function checkActorEligibility(handler: EdgeHandler, actor: Actor, card: BoardCard): MoveResult | null {
  const permError = checkPermissions(handler, actor, card);
  if (permError) return permError;

  if (handler.precheck && !handler.precheck(actor, card).ok) {
    const hint = handler.precheck(actor, card).hintAr;
    return { ok: false, code: "GUARD_FAILED", messageAr: getRefusalMessageAr("GUARD_FAILED", hint), card };
  }
  if (handler.kind === "UNAVAILABLE") {
    return { ok: false, code: "DEPENDENCY_UNAVAILABLE", messageAr: getRefusalMessageAr("DEPENDENCY_UNAVAILABLE"), card };
  }
  return null;
}

function isInputValid(handler: EdgeHandler, input?: unknown): boolean {
  if (!handler.inputSchema) return true;
  return handler.inputSchema.safeParse(input).success;
}

function buildSuccessResult(refreshed: BoardCard | undefined, fallback: BoardCard): MoveResult {
  const card = refreshed ?? fallback;
  const transitionIds = card.lastTransitionId ? [card.lastTransitionId] : [];
  return { ok: true, card, transitionIds };
}

async function executeAction(ctx: ExecutionContext): Promise<MoveResult> {
  const { handler, actor, card, req, prismaClient = db } = ctx;
  if (!isInputValid(handler, req.input)) {
    return { ok: false, code: "VALIDATION", messageAr: getRefusalMessageAr("VALIDATION"), card };
  }
  if (!handler.execute) {
    return { ok: false, code: "DEPENDENCY_UNAVAILABLE", messageAr: getRefusalMessageAr("DEPENDENCY_UNAVAILABLE"), card };
  }

  try {
    await handler.execute(actor, card, req.input);
    const [refreshed] = await getBoardCards(actor, [req.workItemId], prismaClient);
    return buildSuccessResult(refreshed, card);
  } catch (error) {
    return mapErrorToRefusal(error, card);
  }
}

export async function moveWorkItem(
  actor: Actor,
  req: MoveRequest,
  prismaClient = db,
): Promise<MoveResult> {
  const [card] = await getBoardCards(actor, [req.workItemId], prismaClient);
  if (!card) {
    return { ok: false, code: "NOT_OFFERED", messageAr: getRefusalMessageAr("NOT_OFFERED") };
  }

  const handler = edgeCatalog.get(req.edgeId);
  if (!handler) {
    return { ok: false, code: "NOT_OFFERED", messageAr: getRefusalMessageAr("NOT_OFFERED"), card };
  }

  const staticErr = checkStaticEligibility(handler, card);
  if (staticErr) return staticErr;

  const actorErr = checkActorEligibility(handler, actor, card);
  if (actorErr) return actorErr;

  return executeAction({ handler, actor, card, req, prismaClient });
}
