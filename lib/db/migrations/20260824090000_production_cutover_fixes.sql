DROP INDEX IF EXISTS `uq_hazard_coverage_source`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_hazard_coverage_source`
  ON `hazard_zone_coverage` (`hazard_type`, `region_label`, `source_layer`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_safety_quest_daily_award`
  ON `safety_quest_attempts` (`user_id`, `challenge_id`, `mode`, substr(`created_at`, 1, 10))
  WHERE `points_awarded` > 0;
--> statement-breakpoint
INSERT INTO `api_budget_settings`
  (`id`, `api_provider`, `monthly_budget_usd`, `alert_threshold_percent`)
VALUES
  ('budget-gemini', 'gemini', 100, 80),
  ('budget-openai', 'openai', 100, 80),
  ('budget-mapbox', 'mapbox', 50, 80)
ON CONFLICT (`api_provider`) DO NOTHING;
