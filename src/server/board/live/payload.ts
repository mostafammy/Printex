import { z } from "zod";

export const BoardTransitionPayloadSchema = z.object({
  id: z.string(),
  workItemId: z.string(),
  orderId: z.string(),
  from: z.string(),
  to: z.string(),
  actorId: z.string(),
  at: z.string(),
});

export type BoardTransitionPayload = z.infer<typeof BoardTransitionPayloadSchema>;
