/**
 * Client board DTOs and domain event models.
 * (specs/017-press-floor-board/contracts/board-engine.md, data-model.md §3)
 */

import type {
  MoveRefusalCode,
  SliceId,
  StationId,
  WorkItemState,
} from "~/server/board";
import type { MotionTokens } from "./motion/tokens";

export type { SliceId, MotionTokens };

export type SheetId =
  | "assign-designer" | "reject-design" | "send-back" | "complete-production"
  | "route-department" | "cancel" | "receive" | "handover";

export type SheetInput = Record<string, unknown>;

export interface MoveOption {
  readonly edgeId: string;
  readonly to: WorkItemState;
  readonly kind: "DIRECT" | "SHEET" | "SCREEN";
  readonly sheet: SheetId | null;
  readonly screenHref: string | null;
  readonly backward: boolean; readonly destructive: boolean; readonly groupable: boolean;
  readonly labelAr: string;
}

export interface BoardCard {
  readonly id: string; readonly orderId: string; readonly orderNumber: number;
  readonly orderTagHue: number; readonly customerName: string; readonly title: string;
  readonly quantity: number | null; readonly state: WorkItemState;
  readonly priority: "URGENT" | "NORMAL";
  readonly pricing: "PENDING" | "PRICED" | "DISPUTED" | "NOT_REQUIRED";
  readonly enteredStationAt: string; readonly targetMinutes: number | null; readonly dueAt: string | null;
  readonly reworkCount: number;
  readonly assignee: { readonly id: string; readonly name: string } | null;
  readonly departmentId: string | null;
  readonly moves: readonly MoveOption[];
  readonly lastTransitionId: string | null; readonly lastTransitionAt: string;
}

export interface BlockedHint {
  readonly station: StationId; readonly reasonAr: string;
}

export interface BoardPagination {
  readonly page: number; readonly pageSize: number;
  readonly totalCount?: number; readonly hasMore: boolean; readonly nextCursor: number | null;
}

/**
 * Single chunk size for one lane's infinite scroll.
 *
 * Every lane (work-item state) paginates independently: the initial snapshot
 * carries page 1 per lane, and reaching a lane's end appends exactly one
 * more page for that lane only. No lane ever triggers a fetch for another.
 */
export const BOARD_LANE_PAGE_SIZE = 20;

export interface BoardMeta {
  readonly slice: SliceId; readonly availableSlices: readonly SliceId[];
  readonly totalVisible: number; readonly hiddenSiblingCounts: Readonly<Record<string, number>>;
  readonly blockedHints: readonly BlockedHint[]; readonly pagination?: BoardPagination;
  /** Seeding source for per-lane cursors; the loader owns live cursor truth. */
  readonly lanePagination?: Readonly<Record<string, BoardPagination>>;
}

export interface BoardFilters {
  readonly stations?: readonly StationId[];
  readonly departmentIds?: readonly string[]; readonly designerIds?: readonly string[];
  readonly urgentOnly?: boolean; readonly overdueOnly?: boolean; readonly archive?: boolean;
  readonly pricing?: readonly ("PENDING" | "PRICED" | "DISPUTED")[];
  readonly customerQuery?: string;
}

export interface BoardSnapshot {
  readonly generatedAt: string;
  readonly cards: readonly BoardCard[];
  readonly hiddenSiblingCounts: Readonly<Record<string, number>>;
  readonly slice: SliceId;
  readonly availableSlices: readonly SliceId[];
  readonly blockedHints: readonly BlockedHint[];
  readonly pagination?: BoardPagination;
  /** Per-lane cursors keyed by work-item state — present in lane mode. */
  readonly lanePagination?: Readonly<Record<string, BoardPagination>>;
}

export interface LanePageRequest {
  readonly slice?: SliceId;
  readonly filters?: BoardFilters;
  readonly state: WorkItemState;
  readonly pagination?: { readonly page?: number; readonly pageSize?: number };
}

export interface LanePage {
  readonly state: WorkItemState;
  readonly cards: readonly BoardCard[];
  readonly pagination: BoardPagination;
}

export interface BoardUpdate {
  readonly transitionId: string;
  readonly workItemId: string;
  readonly orderId: string;
  readonly from: WorkItemState;
  readonly to: WorkItemState;
  readonly actor: { readonly id: string; readonly name: string };
  readonly at: string;
}

export type LiveStatus = "connecting" | "open" | "stale" | "resyncing" | "closed";

export interface MoveRequest {
  readonly workItemId: string;
  readonly edgeId: string;
  readonly input?: SheetInput;
  readonly clientMoveId: string;
}

export type MoveResult =
  | { readonly ok: true; readonly card: BoardCard; readonly transitionIds: readonly string[] }
  | { readonly ok: false; readonly code: MoveRefusalCode; readonly messageAr: string; readonly card?: BoardCard };

export interface GroupMoveRequest {
  readonly orderId: string;
  readonly to: WorkItemState;
  readonly input?: SheetInput;
  readonly clientMoveId: string;
}

export type GroupMoveItemResult =
  | { readonly workItemId: string; readonly status: "MOVED"; readonly card: BoardCard }
  | { readonly workItemId: string; readonly status: "REFUSED"; readonly code: MoveRefusalCode; readonly messageAr: string }
  | { readonly workItemId: string; readonly status: "NOT_ELIGIBLE"; readonly reasonAr: string };

export interface GroupMoveResult {
  readonly orderId: string;
  readonly to: WorkItemState;
  readonly items: readonly GroupMoveItemResult[];
}

export interface SnapshotRequest {
  readonly slice?: SliceId;
  readonly filters?: BoardFilters;
  readonly pagination?: { readonly page?: number; readonly pageSize?: number };
  /** When set, the snapshot carries page 1 per lane instead of one global page. */
  readonly lanePageSize?: number;
}

export type ChoreographyKind =
  | "lift" | "travel" | "stamp" | "fly-back"
  | "rework-arc" | "roll-out" | "land" | "instant";

export interface RectLike {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
  readonly top: number; readonly right: number; readonly bottom: number; readonly left: number;
}

export interface MotionContext {
  readonly cardId: string;
  readonly from?: RectLike | null;
  readonly to?: RectLike | null;
  readonly reducedMotion?: boolean;
  readonly tokens?: MotionTokens;
}

export type FeedbackEvent =
  | { readonly type: "MOVE_COMMITTED"; readonly card: BoardCard; readonly transitionIds: readonly string[] }
  | { readonly type: "MOVE_REFUSED"; readonly cardId: string; readonly code: MoveRefusalCode; readonly messageAr: string }
  | { readonly type: "MOVED_BY_OTHER"; readonly cardId: string; readonly actorName: string; readonly toState: WorkItemState }
  | { readonly type: "LIVE_STATUS_CHANGED"; readonly status: LiveStatus }
  | { readonly type: "GROUP_MOVE_DONE"; readonly result: GroupMoveResult };
