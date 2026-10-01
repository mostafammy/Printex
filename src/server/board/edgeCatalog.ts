/**
 * EdgeCatalog: classifies every workflow edge in ALLOWED_EDGES.
 * (contracts/board-server.md §EdgeCatalog, plan.md S1, S2-O)
 */

import type { z } from "zod";
import type { BoardCard, MoveOption, SheetId } from "~/lib/board/types";
import type { Actor, Permission } from "~/server/auth";
import type { WorkItemState } from "~/server/core";

export interface EdgePrecheckResult {
  readonly ok: boolean;
  readonly hintAr?: string;
}

export interface EdgeHandler {
  readonly edgeId: `${WorkItemState}->${WorkItemState}`;
  readonly kind: "DIRECT" | "SHEET" | "SCREEN" | "SYSTEM" | "UNAVAILABLE";
  readonly permission?: Permission;
  readonly departmentScoped?: boolean;
  readonly sheet?: SheetId;
  readonly inputSchema?: z.ZodTypeAny;
  readonly backward: boolean;
  readonly destructive: boolean;
  readonly groupable: boolean;
  readonly labelAr: string;
  precheck?(actor: Actor, card: BoardCard): EdgePrecheckResult;
  needsInput?(card: BoardCard): boolean;
  screenHref?(card: BoardCard): string;
  execute?(actor: Actor, card: BoardCard, input?: unknown): Promise<void>;
  groupAction?(
    actor: Actor,
    cards: readonly BoardCard[],
    input?: unknown,
  ): Promise<Map<string, unknown>>;
}

export class EdgeCatalog {
  private readonly handlers = new Map<string, EdgeHandler>();

  register(handler: EdgeHandler): void {
    if (this.handlers.has(handler.edgeId)) {
      throw new Error(`Duplicate EdgeHandler registered for edgeId: ${handler.edgeId}`);
    }
    this.handlers.set(handler.edgeId, handler);
  }

  get(edgeId: string): EdgeHandler | undefined {
    return this.handlers.get(edgeId);
  }

  getAll(): readonly EdgeHandler[] {
    return Array.from(this.handlers.values());
  }

  offer(actor: Actor, card: BoardCard): MoveOption[] {
    const options: MoveOption[] = [];
    for (const handler of this.handlers.values()) {
      if (this.canOffer(handler, actor, card)) {
        options.push(this.toMoveOption(handler, card));
      }
    }
    return options;
  }

  private canOffer(handler: EdgeHandler, actor: Actor, card: BoardCard): boolean {
    if (!this.matchesStateAndKind(handler, card.state)) return false;
    if (!this.matchesPermissions(handler, actor, card)) return false;
    return this.passesPrecheck(handler, actor, card);
  }

  private matchesStateAndKind(handler: EdgeHandler, state: string): boolean {
    if (!handler.edgeId.startsWith(`${state}->`)) return false;
    return handler.kind !== "SYSTEM" && handler.kind !== "UNAVAILABLE";
  }

  private matchesPermissions(handler: EdgeHandler, actor: Actor, card: BoardCard): boolean {
    const hasAdminOverride =
      actor.permissions.has("admin.override") ||
      actor.roles.includes("ADMIN_OWNER");

    if (handler.permission && !actor.permissions.has(handler.permission) && !hasAdminOverride) return false;
    if (handler.departmentScoped && card.departmentId && !hasAdminOverride) {
      return actor.departmentIds.includes(card.departmentId);
    }
    return true;
  }

  private passesPrecheck(handler: EdgeHandler, actor: Actor, card: BoardCard): boolean {
    return !handler.precheck || handler.precheck(actor, card).ok;
  }

  private toMoveOption(handler: EdgeHandler, card: BoardCard): MoveOption {
    const targetState = handler.edgeId.split("->")[1] as WorkItemState;
    const reqInput = handler.needsInput ? handler.needsInput(card) : handler.kind === "SHEET";
    const kind = handler.kind === "SCREEN" ? "SCREEN" : reqInput ? "SHEET" : "DIRECT";
    const sheet = reqInput ? (handler.sheet ?? null) : null;
    const screenHref = handler.screenHref ? handler.screenHref(card) : null;

    return {
      edgeId: handler.edgeId,
      to: targetState,
      kind,
      sheet,
      screenHref,
      backward: handler.backward,
      destructive: handler.destructive,
      groupable: handler.groupable,
      labelAr: handler.labelAr,
    };
  }
}
