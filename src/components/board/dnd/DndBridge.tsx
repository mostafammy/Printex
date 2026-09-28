"use client";

/**
 * DndBridge: integrates @dnd-kit/core events with DragSession and BoardController.
 * (research.md R7, SC-010, plan.md S1)
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
import type { StationId } from "~/server/board";
import { useBoardController } from "../hooks/useBoardController";
import { JobTicket } from "../JobTicket";
import { ARABIC_DND_ANNOUNCEMENTS } from "./dndAnnouncements.ar";
import { useBoardSensors } from "./sensors";

export interface DndBridgeProps {
  readonly children: React.ReactNode;
}

const dropAnimation: DropAnimation = {
  duration: 300,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.35" } },
  }),
};

function CardDragOverlay({ card }: { readonly card: BoardCard | null }) {
  if (!card) return null;
  return (
    <DragOverlay dropAnimation={dropAnimation}>
      <div className="drag-overlay-enter pointer-events-none cursor-grabbing opacity-90 shadow-2xl">
        <JobTicket card={card} />
      </div>
    </DragOverlay>
  );
}

export function DndBridge({ children }: DndBridgeProps) {
  const controller = useBoardController();
  const sensors = useBoardSensors();
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);

  const onStart = (e: DragStartEvent) => {
    const c = controller.getCard(String(e.active.id));
    if (c) { setActiveCard(c); controller.dragSession?.start(c); }
  };

  const onOver = (e: DragOverEvent) => {
    controller.dragSession?.setOver(e.over?.id ? (String(e.over.id) as StationId) : null);
  };

  const endDrag = (station: StationId | null) => {
    setActiveCard(null);
    if (station) { void controller.handleDropOnStation(station); }
    else { controller.dragSession?.cancel(); }
  };

  const onEnd = (e: DragEndEvent) => {
    endDrag(e.over?.id ? (String(e.over.id) as StationId) : null);
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements: ARABIC_DND_ANNOUNCEMENTS }}
      autoScroll={{ threshold: { x: 0.1, y: 0.1 }, acceleration: 10 }}
      onDragStart={onStart}
      onDragOver={onOver}
      onDragEnd={onEnd}
      onDragCancel={() => { setActiveCard(null); controller.dragSession?.cancel(); }}
    >
      <div className="contents" data-dragging={activeCard ? true : undefined}>
        {children}
      </div>
      <CardDragOverlay card={activeCard} />
    </DndContext>
  );
}
