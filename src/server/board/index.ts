/**
 * Public barrel for server board module (~/server/board).
 * (specs/017-press-floor-board/plan.md §Project Structure, S1, S4)
 */

export type { WorkItemState } from "~/server/core";

export type { StationId, InkName, Station, Lane, Placement } from "./stations";
export { STATIONS, STATE_PLACEMENT, OFF_BOARD_STATES } from "./stations";

export type { SliceId, SliceDefinition } from "./slices";
export {
  SLICES,
  ROLE_DEFAULT_SLICE,
  ROLE_PRECEDENCE,
  resolveDefaultSlice,
  resolveAvailableSlices,
} from "./slices";

export type { MoveRefusalCode } from "./messages";
export { MOVE_REFUSAL_MESSAGES_AR, getRefusalMessageAr } from "./messages";

export {
  canSeeWorkItem,
  toPrismaWhere,
  hasFloorWideVisibility,
} from "./visibility";
export type { WorkItemVisibilityItem } from "./visibility";

export {
  loadStationTargetsConfig,
  resetStationTargetsConfigCache,
  DEFAULT_STATION_TARGETS,
} from "./config";
export type { StationTargets } from "./config";

export { getBoardSnapshot, getBoardCards } from "./snapshot";
export { getBoardLanePage, sliceLaneStates } from "./lanePage";
export { EdgeCatalog, type EdgeHandler } from "./edgeCatalog";
export { edgeCatalog } from "./edges";
export { moveWorkItem } from "./move";
export { groupMoveWorkItems } from "./groupMove";
export { getBoardLiveHub, BoardLiveHub } from "./live/hub";
export type { BoardTransitionPayload } from "./live/payload";
