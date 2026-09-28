-- Feature 017: Press Floor Board
-- Trigger: board_transition_notify
-- Dispatches Postgres NOTIFY on channel 'board_transition' after each committed transition insert.
-- (specs/017-press-floor-board/data-model.md §1.2, research.md R4, FR-024)

CREATE OR REPLACE FUNCTION notify_board_transition() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'board_transition',
    json_build_object(
      'id', NEW.id,
      'workItemId', NEW."workItemId",
      'orderId', (SELECT "orderId" FROM "WorkItem" WHERE id = NEW."workItemId"),
      'from', NEW."from",
      'to', NEW."to",
      'actorId', NEW."actorId",
      'at', NEW."at"
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS board_transition_notify ON "WorkItemTransition";

CREATE TRIGGER board_transition_notify
  AFTER INSERT ON "WorkItemTransition"
  FOR EACH ROW
  EXECUTE FUNCTION notify_board_transition();
