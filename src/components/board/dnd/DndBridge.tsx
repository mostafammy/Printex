"use client";

/**
 * DndBridge: integrates @dnd-kit/core events with DragSession and BoardController.
 * (research.md R7, SC-010, plan.md S1)
 *
 * The live drop-target feedback from 817f251 lives here: onDragOver tells
 * DragSession which station is under the pointer, and data-dragging is the
 * hook the cursor rules in ink.css key off.
 */

import {
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import React, { useState } from "react";
import type { BoardCard } from "~/lib/board/types";
import { STATE_PLACEMENT } from "~/lib/board/stations";
import type { StationId, WorkItemState } from "~/server/board";
import { useBoardController } from "../hooks/useBoardController";
import { JobTicket } from "../JobTicket";
import { ARABIC_DND_ANNOUNCEMENTS } from "./dndAnnouncements.ar";
import { useBoardSensors } from "./sensors";

export interface DndBridgeProps {
  readonly children: React.ReactNode;
}

const dropAnimation: DropAnimation = {
  duration: 260,
  easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.45" } },
  }),
};

function CardDragOverlay({ card }: { readonly card: BoardCard | null }) {
  const controller = useBoardController();
  const session = controller.dragSession;
  const [, setTick] = React.useState(0);
  React.useEffect(() => session?.subscribe(() => setTick((t) => t + 1)), [session]);
  if (!card) return null;
  // Cross-phase delight: while the card hovers a different station than the
  // one it came from, the overlay grows slightly — the physical metaphor of
  // lifting higher for a longer flight. `scale` (not `transform`) so it never
  // fights the enter keyframes' rotate in ink.css.
  const origin = STATE_PLACEMENT[card.state];
  const traveling =
    session?.overStation != null &&
    origin !== "OFF_BOARD" &&
    session.overStation !== origin.station;
  return (
    <DragOverlay dropAnimation={dropAnimation}>
      {/* .drag-overlay-enter lifts and rotates the card as it leaves the
          stack; the keyframes and their reduced-motion kill-switch live in
          ink.css. The drop animation then flies it back into the lane. */}
      <div
        className={`drag-overlay-enter relative pointer-events-none cursor-grabbing opacity-95 shadow-2xl${traveling ? " drag-overlay-travel" : ""}`}
      >
        <JobTicket card={card} />
        {traveling && (
          <div className="absolute -bottom-3 inset-x-0 flex justify-center animate-in fade-in zoom-in-95 duration-150">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/95 backdrop-blur-md px-3 py-0.5 text-[11px] font-bold text-primary-foreground shadow-lg shadow-primary/40 ring-2 ring-background border border-white/20">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
              <span>دفع إلى المرحلة التالية ←</span>
            </span>
          </div>
        )}
      </div>
    </DragOverlay>
  );
}

function dropTargetFor(rawId: string | number | null | undefined): StationId | WorkItemState | null {
  if (rawId == null) return null;
  return String(rawId) as StationId | WorkItemState;
}

function isBoardState(target: StationId | WorkItemState): target is WorkItemState {
  return target in STATE_PLACEMENT;
}

function useDropEvents(
  controller: ReturnType<typeof useBoardController>,
  setActiveCard: (card: BoardCard | null) => void,
) {
  const onStart = (e: DragStartEvent) => {
    const c = controller.getCard(String(e.active.id));
    if (c) { setActiveCard(c); controller.dragSession?.start(c); }
  };

  // Drop targets come in two granularities: lane sections register
  // their state id, columns and rail tabs their station id. A state id
  // is always a STATE_PLACEMENT key; station ids never are.
  const onOver = (e: DragOverEvent) => {
    const session = controller.dragSession;
    if (!session) return;
    const target = dropTargetFor(e.over?.id ?? null);
    if (target !== null && isBoardState(target)) {
      const placement = STATE_PLACEMENT[target];
      session.setOverState(target);
      session.setOver(placement === "OFF_BOARD" ? null : placement.station);
    } else {
      session.setOverState(null);
      session.setOver(target);
    }
  };

  const onEnd = (e: DragEndEvent) => {
    const target = dropTargetFor(e.over?.id ?? null);
    setActiveCard(null);
    if (target === null) {
      controller.dragSession?.cancel();
    } else {
      void controller.handleDrop(target);
    }
  };

  const onCancel = () => {
    setActiveCard(null);
    controller.dragSession?.cancel();
  };

  return { onStart, onOver, onEnd, onCancel };
}

export function DndBridge({ children }: DndBridgeProps) {
  const controller = useBoardController();
  const sensors = useBoardSensors();
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const events = useDropEvents(controller, setActiveCard);

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements: ARABIC_DND_ANNOUNCEMENTS }}
      autoScroll={{ threshold: { x: 0.1, y: 0.1 }, acceleration: 10 }}
      onDragStart={events.onStart}
      onDragOver={events.onOver}
      onDragEnd={events.onEnd}
      onDragCancel={events.onCancel}
    >
      {/* .contents keeps the wrapper out of the flex chain while still
          carrying data-dragging, which the grabbing / not-allowed cursor
          rules in ink.css select on. */}
      <div className="contents" data-dragging={activeCard ? true : undefined}>
        {children}
      </div>
      <CardDragOverlay card={activeCard} />
    </DndContext>
  );
}
