// Transactional notification outbox recorder — plan.md §5.2 (Outbox
// pattern), contracts/notifications.md.
//
// Writes exactly one `NotificationEvent` row inside the caller's `tx`. Never
// opens its own transaction, never delivers anything itself — delivery
// (WhatsApp, etc.) is 053's separately hosted concern (constitution VII).

import type { Prisma } from "../../../../generated/prisma";
import type { JsonValue } from "../json";

export interface NotifyEvent {
  readonly type: string;
  readonly entity: { readonly type: string; readonly id: string };
  readonly recipients: {
    readonly userIds?: readonly string[];
    readonly roles?: readonly string[];
    readonly departmentIds?: readonly string[];
  };
  readonly payload?: JsonValue;
}

/**
 * Records one outbox row for `event`, using the caller's transaction client
 * (`tx`) — always the same `tx` the triggering write used
 * (contracts/notifications.md "Rules for consumers"), so a recorded event
 * never survives the rollback of the write that caused it.
 */
export async function notify(tx: Prisma.TransactionClient, event: NotifyEvent): Promise<void> {
  await tx.notificationEvent.create({
    data: {
      type: event.type,
      entityType: event.entity.type,
      entityId: event.entity.id,
      recipientUserIds: [...(event.recipients.userIds ?? [])],
      recipientRoles: [...(event.recipients.roles ?? [])],
      recipientDepartmentIds: [...(event.recipients.departmentIds ?? [])],
      // Prisma's `Json` input type accepts our recursive `JsonValue` shape
      // structurally; `?? undefined` keeps an omitted payload as SQL NULL
      // rather than writing the JSON literal `null`.
      payload: event.payload ?? undefined,
    },
  });
}
