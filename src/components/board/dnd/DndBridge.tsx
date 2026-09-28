"use client";

/**
 * DndBridge: integrates @dnd-kit/core events with DragSession and BoardController.
 * (research.md R7, SC-010, plan.md S1)
 */

import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
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

function CardDragOverlay({ card }: { readonly card: BoardCard | null }) {
  if (!card) return null;
  return (
    <DragOverlay dropAnimation={null}>
      <div className="rotate-2 scale-105 shadow-2xl opacity-90 pointer-events-none cursor-grabbing">
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

  const onEnd = (e: DragEndEvent) => {
    setActiveCard(null);
    const station = e.over?.id ? (String(e.over.id) as StationId) : null;
    if (station) { void controller.handleDropOnStation(station); }
    else { controller.dragSession?.cancel(); }
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements: ARABIC_DND_ANNOUNCEMENTS }}
      autoScroll={{ threshold: { x: 0.1, y: 0.1 }, acceleration: 10 }}
      onDragStart={onStart}
      onDragEnd={onEnd}
      onDragCancel={() => { setActiveCard(null); controller.dragSession?.cancel(); }}
    >
      {children}
      <CardDragOverlay card={activeCard} />
    </DndContext>
  );
}
