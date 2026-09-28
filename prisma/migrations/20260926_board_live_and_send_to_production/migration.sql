-- Feature 017: Press Floor Board
-- Apply board transition notification trigger and grant workitem.send_to_production permission to RECEPTION and ADMIN_OWNER

-- 1. Notification Trigger on WorkItemTransition
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

-- 2. Idempotent grant of workitem.send_to_production to RECEPTION and ADMIN_OWNER
INSERT INTO "role_permission" ("id", "roleId", "permission")
SELECT 'perm_rec_send_to_prod', id, 'workitem.send_to_production'
FROM "role" WHERE key = 'RECEPTION'
ON CONFLICT ("roleId", "permission") DO NOTHING;

INSERT INTO "role_permission" ("id", "roleId", "permission")
SELECT 'perm_admin_send_to_prod', id, 'workitem.send_to_production'
FROM "role" WHERE key = 'ADMIN_OWNER'
ON CONFLICT ("roleId", "permission") DO NOTHING;
