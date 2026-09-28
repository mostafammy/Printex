import { getActor } from "~/server/auth";
import {
  canSeeWorkItem,
  getBoardLiveHub,
  type BoardTransitionPayload,
} from "~/server/board";
import { db } from "~/server/db";
import type { BoardUpdate } from "~/lib/board/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let actor = await getActor();
  if (!actor) {
    return new Response("Unauthorized", { status: 401 });
  }

  const hub = getBoardLiveHub();
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let authTimer: NodeJS.Timeout | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: string, id?: string) => {
        let frame = id ? `id: ${id}\n` : "";
        frame += `event: ${event}\ndata: ${data}\n\n`;
        controller.enqueue(new TextEncoder().encode(frame));
      };

      // Initial frames per contract
      controller.enqueue(new TextEncoder().encode("retry: 3000\n\n"));
      sendEvent("hello", JSON.stringify({ serverTime: new Date().toISOString() }));

      // Heartbeat comment every 20s
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": hb\n\n"));
        } catch {
          // Stream might be closed
        }
      }, 20000);

      // Re-check auth every 5 min
      authTimer = setInterval(() => {
        void (async () => {
          try {
            const freshActor = await getActor();
            if (!freshActor) {
              controller.close();
            } else {
              actor = freshActor;
            }
          } catch {
            controller.close();
          }
        })();
      }, 300000);

      unsubscribe = hub.subscribe({
        id: `sse-${Math.random().toString(36).slice(2)}`,
        onResync: () => {
          sendEvent("resync", "{}");
        },
        onUpdate: (update: BoardUpdate, payload: BoardTransitionPayload) => {
          void (async () => {
            try {
              const workItem = await db.workItem.findUnique({
                where: { id: payload.workItemId },
                select: {
                  id: true,
                  state: true,
                  assigneeId: true,
                  departmentId: true,
                  productType: { select: { defaultDepartmentId: true } },
                },
              });
              if (!workItem) return;
              const visible = canSeeWorkItem(actor, {
                id: workItem.id,
                state: workItem.state,
                assigneeId: workItem.assigneeId,
                departmentId: workItem.departmentId,
                effectiveDepartmentId: workItem.departmentId ?? workItem.productType?.defaultDepartmentId,
              });
              if (visible) {
                sendEvent("transition", JSON.stringify(update), payload.id);
              }
            } catch (err) {
              console.error("[SSE] Failed to process live update:", err);
            }
          })();
        },
      });
    },
    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (authTimer) clearInterval(authTimer);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
