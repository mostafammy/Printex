/**
 * Sole composition root and factory for BoardController and its object graph.
 * (specs/017-press-floor-board/plan.md S1, S2-D, S3)
 */

import {
  ServerActionMoveGateway,
  type CardsFetcher,
  type MoveSender,
} from "./adapters/ServerActionMoveGateway";
import {
  ServerActionSnapshotGateway,
  type LanePageFetcher,
  type SnapshotFetcher,
} from "./adapters/ServerActionSnapshotGateway";
import { SystemClock } from "./adapters/SystemClock";
import { BoardController } from "./BoardController";
import { DragSession } from "./drag/DragSession";
import { AnnouncerChannel } from "./feedback/AnnouncerChannel";
import { FeedbackCenter } from "./feedback/FeedbackCenter";
import { ToastChannel, type ToastFn } from "./feedback/ToastChannel";
import { EventSourceLiveSource } from "./live/EventSourceLiveSource";
import { WaapiMotionDirector } from "./motion/WaapiMotionDirector";
import { DirectDropPolicy } from "./policies/DirectDropPolicy";
import { DropPolicyResolver } from "./policies/DropPolicyResolver";
import { ScreenDropPolicy } from "./policies/ScreenDropPolicy";
import { SheetDropPolicy } from "./policies/SheetDropPolicy";
import type { Clock, FeedbackPort, LiveSource, MotionPort, MoveGateway, SnapshotGateway } from "./ports";
import { SheetManager } from "./sheets/SheetManager";
import { BoardStore } from "./store/BoardStore";
import type { FrameScheduler } from "./store/FrameBatcher";
import type { BoardSnapshot, GroupMoveRequest, GroupMoveResult } from "./types";

export type GroupMoveSender = (req: GroupMoveRequest) => Promise<GroupMoveResult>;

export interface CreateBoardControllerOptions {
  readonly clock?: Clock;
  readonly snapshotGateway?: SnapshotGateway;
  readonly fetchSnapshot?: SnapshotFetcher;
  readonly fetchLanePage?: LanePageFetcher;
  readonly moveGateway?: MoveGateway;
  readonly liveSource?: LiveSource;
  readonly moveSender?: MoveSender;
  readonly groupMoveSender?: GroupMoveSender;
  readonly cardsFetcher?: CardsFetcher;
  readonly motion?: MotionPort;
  readonly feedback?: FeedbackPort;
  readonly dropPolicies?: DropPolicyResolver;
  readonly dragSession?: DragSession;
  readonly sheetManager?: SheetManager;
  readonly scheduler?: FrameScheduler;
  readonly showToast?: ToastFn;
  readonly navigate?: (href: string) => void;
}

function resolveSnapshotGateway(
  initialSnapshot: BoardSnapshot,
  options: CreateBoardControllerOptions,
): SnapshotGateway {
  if (options.snapshotGateway) return options.snapshotGateway;
  return new ServerActionSnapshotGateway(
    options.fetchSnapshot ?? (async () => initialSnapshot),
    options.fetchLanePage,
  );
}

function resolveMoveGateway(options: CreateBoardControllerOptions): MoveGateway {
  if (options.moveGateway) return options.moveGateway;
  return new ServerActionMoveGateway({
    moveSender: options.moveSender ?? (async () => ({ ok: false, code: "INTERNAL", messageAr: "" })),
    cardsFetcher: options.cardsFetcher ?? (async () => []),
    groupMoveSender: options.groupMoveSender,
  });
}

function resolveLiveSource(source?: LiveSource): LiveSource | undefined {
  if (source) return source;
  return typeof window !== "undefined" ? new EventSourceLiveSource() : undefined;
}

function setupFeedback(options?: CreateBoardControllerOptions): FeedbackPort {
  const fb = options?.feedback ?? new FeedbackCenter();
  if (options?.showToast && fb instanceof FeedbackCenter) {
    fb.subscribe(new ToastChannel(options.showToast).handle);
  }
  if (fb instanceof FeedbackCenter) {
    fb.subscribe(new AnnouncerChannel().handle);
  }
  return fb;
}

interface BuildDropPoliciesArgs {
  readonly moveDeps: ConstructorParameters<typeof DirectDropPolicy>[0];
  readonly sheetManager: SheetManager;
  readonly motion: MotionPort;
  readonly navigate: (href: string) => void;
}

function buildDropPolicies(args: BuildDropPoliciesArgs): DropPolicyResolver {
  const resolver = new DropPolicyResolver();
  resolver.register("DIRECT", new DirectDropPolicy(args.moveDeps));
  resolver.register("SHEET", new SheetDropPolicy({
    moveDeps: args.moveDeps,
    sheetManager: args.sheetManager,
  }));
  resolver.register("SCREEN", new ScreenDropPolicy({
    motion: args.motion,
    navigate: args.navigate,
  }));
  return resolver;
}

export function createBoardController(
  initialSnapshot: BoardSnapshot,
  options: CreateBoardControllerOptions = {},
): BoardController {
  const store = new BoardStore(initialSnapshot, options.clock ?? new SystemClock(), options.scheduler);
  const snapshotGateway = resolveSnapshotGateway(initialSnapshot, options);
  const moveGateway = resolveMoveGateway(options);
  const liveSource = resolveLiveSource(options.liveSource);
  const motion = options.motion ?? new WaapiMotionDirector();
  const feedback = setupFeedback(options);
  const sheetManager = options.sheetManager ?? new SheetManager();
  const moveDeps = { store, gateway: moveGateway, motion, feedback };

  const dropPolicies = options.dropPolicies ?? buildDropPolicies({
    moveDeps,
    sheetManager,
    motion,
    navigate: options.navigate ?? ((href) => { window.location.href = href; }),
  });

  return new BoardController({
    store,
    snapshotGateway,
    moveGateway,
    liveSource,
    motion,
    feedback,
    dropPolicies,
    dragSession: options.dragSession ?? new DragSession(),
    sheetManager,
  });
}
