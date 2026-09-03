CREATE TABLE `report_create_history` (
	`report_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_report_create_user_time` ON `report_create_history` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_report_create_time` ON `report_create_history` (`created_at`);--> statement-breakpoint
-- Add in place: rebuilding danger_reports could cascade-delete related rows.
-- NULL explicitly excludes pre-cutover rewards from both awards and revocations.
ALTER TABLE danger_reports ADD COLUMN reward_points integer
  CONSTRAINT dr_reward_points CHECK (reward_points IS NULL OR reward_points IN (0, 20));
--> statement-breakpoint
-- Serialize quota enforcement with the successful report INSERT. History has
-- no cascading FK, and its timestamp is DB-controlled, not client-controlled.
CREATE TRIGGER report_create_quota AFTER INSERT ON danger_reports
BEGIN
  SELECT CASE WHEN (
    SELECT count(*) FROM report_create_history
    WHERE user_id = NEW.user_id AND created_at > unixepoch() - 3600
  ) >= 10 THEN RAISE(ABORT, 'REPORT_CREATE_HOURLY_LIMIT') END;
  SELECT CASE WHEN (
    SELECT count(*) FROM report_create_history
    WHERE user_id = NEW.user_id AND created_at > unixepoch() - 86400
  ) >= 50 THEN RAISE(ABORT, 'REPORT_CREATE_DAILY_LIMIT') END;
  INSERT INTO report_create_history (report_id, user_id, created_at)
    VALUES (NEW.id, NEW.user_id, unixepoch());
  DELETE FROM report_create_history WHERE report_id IN (
    SELECT report_id FROM report_create_history
    WHERE created_at <= unixepoch() - 86400 ORDER BY created_at LIMIT 1000
  );
END;
--> statement-breakpoint
-- All status writers (AI, admin, sweep, image reopening) share these atomic
-- effects. Only the server opts new reports in with reward_points = 0.
CREATE TRIGGER report_reward_approve AFTER UPDATE OF status ON danger_reports
WHEN OLD.reward_points = 0 AND NEW.status IN ('approved', 'published', 'resolved')
BEGIN
  INSERT INTO user_points (user_id, points, level, updated_at)
    VALUES (NEW.user_id, 20, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(user_id) DO UPDATE SET
      points = user_points.points + 20,
      level = CAST((user_points.points + 20) / 500 AS integer) + 1,
      updated_at = excluded.updated_at;
  UPDATE danger_reports SET reward_points = 20 WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER report_reward_revoke AFTER UPDATE OF status ON danger_reports
WHEN OLD.reward_points = 20 AND NEW.status IN ('pending', 'rejected')
BEGIN
  INSERT INTO user_points (user_id, points, level, updated_at)
    VALUES (OLD.user_id, 0, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(user_id) DO UPDATE SET
      points = max(0, user_points.points - 20),
      level = CAST(max(0, user_points.points - 20) / 500 AS integer) + 1,
      updated_at = excluded.updated_at;
  UPDATE danger_reports SET reward_points = 0 WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER report_reward_delete AFTER DELETE ON danger_reports
WHEN OLD.reward_points = 20
BEGIN
  INSERT INTO user_points (user_id, points, level, updated_at)
    VALUES (OLD.user_id, 0, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(user_id) DO UPDATE SET
      points = max(0, user_points.points - 20),
      level = CAST(max(0, user_points.points - 20) / 500 AS integer) + 1,
      updated_at = excluded.updated_at;
END;
