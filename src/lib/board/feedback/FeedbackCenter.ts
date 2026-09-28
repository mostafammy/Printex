/**
 * FeedbackCenter: concrete FeedbackPort coordinating toast notifications and audio/announcements.
 * (contracts/board-engine.md §FeedbackPort, data-model.md §4, plan.md S1, S3)
 */

import type { FeedbackPort } from "../ports";
import type { FeedbackEvent } from "../types";

export type FeedbackChannel = (event: FeedbackEvent) => void;

export class FeedbackCenter implements FeedbackPort {
  private readonly channels = new Set<FeedbackChannel>();

  subscribe(channel: FeedbackChannel): () => void {
    this.channels.add(channel);
    return () => {
      this.channels.delete(channel);
    };
  }

  notify(event: FeedbackEvent): void {
    for (const channel of this.channels) {
      try {
        channel(event);
      } catch {
        // Channel errors must not break command execution
      }
    }
  }
}
