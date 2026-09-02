CREATE TABLE `traffic_accidents` (
	`id` integer PRIMARY KEY NOT NULL,
	`record_number` text NOT NULL,
	`prefecture_code` integer NOT NULL,
	`police_station_code` text NOT NULL,
	`municipality_code` text,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`occurred_at` text,
	`source_year` integer NOT NULL,
	`severity_code` integer,
	`accident_type_code` text,
	`accident_type_label` text,
	`fatalities` integer,
	`injuries` integer,
	`involves_child` integer DEFAULT false NOT NULL,
	`involves_pedestrian` integer DEFAULT false NOT NULL,
	`party_a_age` integer,
	`party_a_type_code` text,
	`party_b_age` integer,
	`party_b_type_code` text,
	`day_night_code` integer,
	`day_of_week` integer,
	`road_shape_code` text,
	`road_shape_label` text,
	`road_surface_code` integer,
	`road_width_code` text,
	`sidewalk_code` text,
	`sidewalk_label` text,
	`signal_code` text,
	`terrain_code` integer,
	`weather_code` integer,
	`weather_label` text,
	`zone_regulation_code` text,
	`imported_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_traffic_accidents_year_lat_lng` ON `traffic_accidents` (`source_year`,`lat`,`lng`);--> statement-breakpoint
CREATE INDEX `idx_traffic_accidents_child_year_lat_lng` ON `traffic_accidents` (`involves_child`,`source_year`,`lat`,`lng`);--> statement-breakpoint
CREATE INDEX `idx_traffic_accidents_ped_year_lat_lng` ON `traffic_accidents` (`involves_pedestrian`,`source_year`,`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`threshold` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `missions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`period` text,
	`target_type` text,
	`target_value` integer,
	`reward_points` integer,
	`reward_badge_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `safety_quest_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`challenge_id` text,
	`mode` text NOT NULL,
	`user_markers` text DEFAULT '[]' NOT NULL,
	`answer_payload` text,
	`score` integer DEFAULT 0 NOT NULL,
	`accuracy` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer,
	`points_awarded` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "safety_quest_mode" CHECK("safety_quest_attempts"."mode" in ('hazard','quiz-battle','private-practice')),
	CONSTRAINT "safety_quest_score" CHECK("safety_quest_attempts"."score" between 0 and 100 and "safety_quest_attempts"."accuracy" between 0 and 100),
	CONSTRAINT "safety_quest_points" CHECK("safety_quest_attempts"."points_awarded" between 0 and 1000),
	CONSTRAINT "safety_quest_markers_json" CHECK(json_valid("safety_quest_attempts"."user_markers") and json_type("safety_quest_attempts"."user_markers") = 'array'),
	CONSTRAINT "safety_quest_answer_json" CHECK("safety_quest_attempts"."answer_payload" is null or json_valid("safety_quest_attempts"."answer_payload"))
);
--> statement-breakpoint
CREATE INDEX `idx_safety_quest_user_created` ON `safety_quest_attempts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_safety_quest_challenge` ON `safety_quest_attempts` (`challenge_id`);--> statement-breakpoint
CREATE TABLE `user_badges` (
	`user_id` text NOT NULL,
	`badge_id` integer NOT NULL,
	`acquired_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`user_id`, `badge_id`),
	FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_badges_user_acquired` ON `user_badges` (`user_id`,`acquired_at`);--> statement-breakpoint
CREATE TABLE `user_mission_progress` (
	`user_id` text NOT NULL,
	`mission_id` integer NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`user_id`, `mission_id`),
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "mission_progress_nonnegative" CHECK("user_mission_progress"."progress" >= 0)
);
--> statement-breakpoint
CREATE TABLE `user_points` (
	`user_id` text PRIMARY KEY NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "user_points_nonnegative" CHECK("user_points"."points" >= 0 and "user_points"."level" >= 1)
);
--> statement-breakpoint
CREATE INDEX `idx_user_points_leaderboard` ON `user_points` (`points`,`level`);--> statement-breakpoint
CREATE TABLE `hazard_image_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`hazard_type` text NOT NULL,
	`risk_level` integer NOT NULL,
	`area_context` text NOT NULL,
	`scenario_key` text NOT NULL,
	`provider` text DEFAULT 'gemini' NOT NULL,
	`depth_label` text NOT NULL,
	`prompt_en` text NOT NULL,
	`prompt_signature` text NOT NULL,
	`object_key` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`generated_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "hazard_cache_type" CHECK("hazard_image_cache"."hazard_type" in ('flood','tsunami')),
	CONSTRAINT "hazard_cache_risk" CHECK("hazard_image_cache"."risk_level" between 1 and 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_hazard_image_cache_lookup` ON `hazard_image_cache` (`hazard_type`,`risk_level`,`area_context`,`scenario_key`,`provider`,`prompt_signature`);--> statement-breakpoint
CREATE TABLE `hazard_zone_coverage` (
	`id` text PRIMARY KEY NOT NULL,
	`coverage_group_id` text NOT NULL,
	`hazard_type` text NOT NULL,
	`region_label` text NOT NULL,
	`source` text NOT NULL,
	`source_layer` text NOT NULL,
	`geojson` text NOT NULL,
	`bbox_min_lng` real NOT NULL,
	`bbox_min_lat` real NOT NULL,
	`bbox_max_lng` real NOT NULL,
	`bbox_max_lat` real NOT NULL,
	`imported_features` integer NOT NULL,
	`imported_at` text NOT NULL,
	CONSTRAINT "hazard_coverage_type" CHECK("hazard_zone_coverage"."hazard_type" in ('flood','tsunami')),
	CONSTRAINT "hazard_coverage_imported" CHECK("hazard_zone_coverage"."imported_features" >= 0),
	CONSTRAINT "hazard_coverage_json" CHECK(json_valid("hazard_zone_coverage"."geojson"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_hazard_coverage_source` ON `hazard_zone_coverage` (`hazard_type`,`region_label`,`source_layer`,`id`);--> statement-breakpoint
CREATE INDEX `idx_hazard_coverage_bbox` ON `hazard_zone_coverage` (`hazard_type`,`bbox_min_lng`,`bbox_max_lng`);--> statement-breakpoint
CREATE INDEX `idx_hazard_coverage_group` ON `hazard_zone_coverage` (`coverage_group_id`);--> statement-breakpoint
CREATE TABLE `hazard_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`zone_group_id` text NOT NULL,
	`hazard_type` text NOT NULL,
	`source_layer` text NOT NULL,
	`risk_level` integer NOT NULL,
	`depth_min_m` real,
	`depth_max_m` real,
	`area_context` text NOT NULL,
	`properties` text DEFAULT '{}' NOT NULL,
	`geojson` text NOT NULL,
	`bbox_min_lng` real NOT NULL,
	`bbox_min_lat` real NOT NULL,
	`bbox_max_lng` real NOT NULL,
	`bbox_max_lat` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "hazard_zone_type" CHECK("hazard_zones"."hazard_type" in ('flood','tsunami')),
	CONSTRAINT "hazard_zone_risk" CHECK("hazard_zones"."risk_level" between 1 and 5),
	CONSTRAINT "hazard_zone_area" CHECK("hazard_zones"."area_context" in ('residential-school-route','riverside','coastal')),
	CONSTRAINT "hazard_zone_json" CHECK(json_valid("hazard_zones"."properties") and json_valid("hazard_zones"."geojson")),
	CONSTRAINT "hazard_zone_bbox_order" CHECK("hazard_zones"."bbox_min_lng" <= "hazard_zones"."bbox_max_lng" and "hazard_zones"."bbox_min_lat" <= "hazard_zones"."bbox_max_lat")
);
--> statement-breakpoint
CREATE INDEX `idx_hazard_zones_lookup` ON `hazard_zones` (`hazard_type`,`risk_level`,`area_context`);--> statement-breakpoint
CREATE INDEX `idx_hazard_zones_bbox` ON `hazard_zones` (`hazard_type`,`bbox_min_lng`,`bbox_max_lng`);--> statement-breakpoint
CREATE INDEX `idx_hazard_zones_group` ON `hazard_zones` (`zone_group_id`);--> statement-breakpoint
CREATE TABLE `image_generation_gate_log` (
	`id` text PRIMARY KEY NOT NULL,
	`route` text NOT NULL,
	`mode` text NOT NULL,
	`situation` text,
	`verdict` text NOT NULL,
	`zone_id` text,
	`lat_rounded` real,
	`lng_rounded` real,
	`user_id` text,
	`latency_ms` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "image_gate_route" CHECK("image_generation_gate_log"."route" in ('hazard-image','generate-image','generate-prompts')),
	CONSTRAINT "image_gate_mode" CHECK("image_generation_gate_log"."mode" in ('log','enforce')),
	CONSTRAINT "image_gate_verdict" CHECK("image_generation_gate_log"."verdict" in ('inside','outside','no_coverage','unavailable')),
	CONSTRAINT "image_gate_latency" CHECK("image_generation_gate_log"."latency_ms" is null or "image_generation_gate_log"."latency_ms" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_image_gate_created` ON `image_generation_gate_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `hazard_detections` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`type` text,
	`region` text,
	`severity` text,
	`kid_explanation` text,
	`safe_action` text,
	`confidence` real,
	`model` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`photo_id`) REFERENCES `hunter_photos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "hazard_detection_region_json" CHECK("hazard_detections"."region" is null or json_valid("hazard_detections"."region"))
);
--> statement-breakpoint
CREATE INDEX `idx_hazard_detections_photo` ON `hazard_detections` (`photo_id`);--> statement-breakpoint
CREATE TABLE `hunter_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text,
	`target_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_hunter_audit_actor_created` ON `hunter_audit_log` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `hunter_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`image_key` text NOT NULL,
	`pin_lat` real,
	`pin_lng` real,
	`captured_at` text,
	`exif_stripped` integer DEFAULT true NOT NULL,
	`masked` integer DEFAULT true NOT NULL,
	`retention_until` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "hunter_photo_lat" CHECK("hunter_photos"."pin_lat" is null or "hunter_photos"."pin_lat" between -90 and 90),
	CONSTRAINT "hunter_photo_lng" CHECK("hunter_photos"."pin_lng" is null or "hunter_photos"."pin_lng" between -180 and 180)
);
--> statement-breakpoint
CREATE INDEX `idx_hunter_photos_player` ON `hunter_photos` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_hunter_photos_retention` ON `hunter_photos` (`retention_until`);--> statement-breakpoint
CREATE TABLE `api_budget_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`api_provider` text NOT NULL,
	`monthly_budget_usd` real,
	`alert_threshold_percent` integer,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "api_budget_amount" CHECK("api_budget_settings"."monthly_budget_usd" is null or "api_budget_settings"."monthly_budget_usd" >= 0),
	CONSTRAINT "api_budget_threshold" CHECK("api_budget_settings"."alert_threshold_percent" is null or "api_budget_settings"."alert_threshold_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_api_budget_provider` ON `api_budget_settings` (`api_provider`);--> statement-breakpoint
CREATE TABLE `api_usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`api_provider` text NOT NULL,
	`api_endpoint` text NOT NULL,
	`model_name` text,
	`request_count` integer DEFAULT 1 NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`estimated_cost_usd` real,
	`success` integer DEFAULT true NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "api_usage_request_count" CHECK("api_usage_logs"."request_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_api_usage_provider_created` ON `api_usage_logs` (`api_provider`,`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`full_name` text,
	`avatar_key` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "profiles_role" CHECK("profiles"."role" in ('user','admin'))
);
--> statement-breakpoint
CREATE INDEX `idx_profiles_email` ON `profiles` (`email`);--> statement-breakpoint
CREATE TABLE `local_safety_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`prefecture` text NOT NULL,
	`city` text,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`source_url` text,
	`occurred_at` text NOT NULL,
	`push_notified_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "local_alert_category" CHECK("local_safety_alerts"."category" in ('suspicious','voice_call','following','other'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_local_alert_location_time` ON `local_safety_alerts` (`prefecture`,`city`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_local_alert_created` ON `local_safety_alerts` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_local_alert_push` ON `local_safety_alerts` (`push_notified_at`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`notification_preferences` text DEFAULT '{"danger_reports":true,"news":true,"magazine":true}' NOT NULL,
	`prefecture` text,
	`last_notified_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "push_preferences_json" CHECK(json_valid("push_subscriptions"."notification_preferences"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_push_user_endpoint` ON `push_subscriptions` (`user_id`,`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_push_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `danger_report_moderation_log` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`mode` text NOT NULL,
	`heuristic_status` text NOT NULL,
	`ai_verdict` text,
	`final_status` text NOT NULL,
	`fallback` integer DEFAULT false NOT NULL,
	`latency_ms` integer,
	`model` text,
	`prompt_version` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `danger_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "moderation_ai_verdict_json" CHECK("danger_report_moderation_log"."ai_verdict" is null or json_valid("danger_report_moderation_log"."ai_verdict"))
);
--> statement-breakpoint
CREATE INDEX `idx_moderation_log_report_created` ON `danger_report_moderation_log` (`report_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `danger_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`danger_type` text NOT NULL,
	`danger_level` integer NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`image_key` text,
	`processed_image_key` text,
	`processed_image_keys` text DEFAULT '[]' NOT NULL,
	`accident_stats` text,
	`accident_risk_score` real,
	`geocode_source` text,
	`geocode_confidence` real,
	`geocoded_at` text,
	`address_hash` text,
	`prefecture` text,
	`prefecture_code` integer,
	`city` text,
	`municipality_code` text,
	`town` text,
	`postal_code` text,
	`alert_radius_m` integer,
	`push_notified_at` text,
	`ai_moderation_status` text,
	`ai_moderation_reason` text,
	`ai_moderation_score` real,
	`ai_moderation_checked_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "dr_danger_level" CHECK("danger_reports"."danger_level" between 1 and 5),
	CONSTRAINT "dr_lat_range" CHECK("danger_reports"."latitude" between -90 and 90),
	CONSTRAINT "dr_lng_range" CHECK("danger_reports"."longitude" between -180 and 180),
	CONSTRAINT "dr_status" CHECK("danger_reports"."status" in ('pending','approved','rejected','resolved','published')),
	CONSTRAINT "dr_geocode_source" CHECK("danger_reports"."geocode_source" is null or "danger_reports"."geocode_source" in ('mapbox','gsi','osm','manual','batch')),
	CONSTRAINT "dr_processed_keys_json" CHECK(json_valid("danger_reports"."processed_image_keys") and json_type("danger_reports"."processed_image_keys") = 'array'),
	CONSTRAINT "dr_accident_stats_json" CHECK("danger_reports"."accident_stats" is null or json_valid("danger_reports"."accident_stats"))
);
--> statement-breakpoint
CREATE INDEX `idx_dr_user` ON `danger_reports` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_dr_status_created` ON `danger_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_dr_lat_lng` ON `danger_reports` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `idx_dr_push` ON `danger_reports` (`push_notified_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_dr_moderation_sweep` ON `danger_reports` (`ai_moderation_status`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `report_images` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text,
	`image_key` text NOT NULL,
	`image_type` text,
	`uploaded_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `danger_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_report_images_report` ON `report_images` (`report_id`);--> statement-breakpoint
CREATE TABLE `route_learning_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`route_id` text NOT NULL,
	`session_id` text NOT NULL,
	`child_id` text,
	`child_name` text,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`reviewed_count` integer DEFAULT 0 NOT NULL,
	`saved_count` integer DEFAULT 0 NOT NULL,
	`quiz_score` integer DEFAULT 0 NOT NULL,
	`quiz_total` integer DEFAULT 0 NOT NULL,
	`checklist` text DEFAULT '[]' NOT NULL,
	`stop_results` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `user_routes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "route_learning_session_id" CHECK(length("route_learning_sessions"."session_id") between 1 and 64),
	CONSTRAINT "route_learning_counts" CHECK("route_learning_sessions"."reviewed_count" >= 0 and "route_learning_sessions"."saved_count" >= 0),
	CONSTRAINT "route_learning_quiz" CHECK("route_learning_sessions"."quiz_total" between 0 and 3 and "route_learning_sessions"."quiz_score" between 0 and "route_learning_sessions"."quiz_total"),
	CONSTRAINT "route_learning_checklist_json" CHECK(json_valid("route_learning_sessions"."checklist") and json_type("route_learning_sessions"."checklist") = 'array'),
	CONSTRAINT "route_learning_results_json" CHECK(json_valid("route_learning_sessions"."stop_results") and json_type("route_learning_sessions"."stop_results") = 'array')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_route_learning_user_route_session` ON `route_learning_sessions` (`user_id`,`route_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `idx_route_learning_user_route_started` ON `route_learning_sessions` (`user_id`,`route_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_route_learning_route` ON `route_learning_sessions` (`route_id`);--> statement-breakpoint
CREATE TABLE `user_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`child_id` text,
	`child_name` text,
	`name` text NOT NULL,
	`description` text,
	`start_address` text NOT NULL,
	`start_lat` real NOT NULL,
	`start_lng` real NOT NULL,
	`end_address` text NOT NULL,
	`end_lat` real NOT NULL,
	`end_lng` real NOT NULL,
	`distance_meters` real,
	`estimated_time_minutes` integer,
	`route_geometry` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "route_start_lat" CHECK("user_routes"."start_lat" between -90 and 90),
	CONSTRAINT "route_start_lng" CHECK("user_routes"."start_lng" between -180 and 180),
	CONSTRAINT "route_end_lat" CHECK("user_routes"."end_lat" between -90 and 90),
	CONSTRAINT "route_end_lng" CHECK("user_routes"."end_lng" between -180 and 180),
	CONSTRAINT "route_geometry_json" CHECK("user_routes"."route_geometry" is null or json_valid("user_routes"."route_geometry"))
);
--> statement-breakpoint
CREATE INDEX `idx_user_routes_user` ON `user_routes` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_routes_user_favorite` ON `user_routes` (`user_id`,`is_favorite`);--> statement-breakpoint
CREATE TABLE `danger_report_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`report_id` text NOT NULL,
	`reaction_type` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `danger_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reaction_user_report_type` ON `danger_report_reactions` (`user_id`,`report_id`,`reaction_type`);--> statement-breakpoint
CREATE INDEX `idx_reactions_report` ON `danger_report_reactions` (`report_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`report_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`link` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `danger_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read_created` ON `notifications` (`user_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE TABLE `report_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`report_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `danger_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_report_bookmarks_user_report` ON `report_bookmarks` (`user_id`,`report_id`);--> statement-breakpoint
CREATE INDEX `idx_report_bookmarks_report` ON `report_bookmarks` (`report_id`);--> statement-breakpoint
CREATE TABLE `report_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_comment_id` text,
	`content` text NOT NULL,
	`is_edited` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `danger_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comments_report_created` ON `report_comments` (`report_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comments_user` ON `report_comments` (`user_id`);--> statement-breakpoint
CREATE TABLE `report_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_user_id` text NOT NULL,
	`target_report_id` text NOT NULL,
	`reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`target_report_id`) REFERENCES `danger_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "report_flags_reason_length" CHECK("report_flags"."reason" is null or length("report_flags"."reason") <= 500)
);
--> statement-breakpoint
CREATE INDEX `idx_report_flags_target` ON `report_flags` (`target_report_id`);--> statement-breakpoint
CREATE INDEX `idx_report_flags_reporter` ON `report_flags` (`reporter_user_id`);--> statement-breakpoint
CREATE TABLE `report_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`report_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `danger_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_report_likes_user_report` ON `report_likes` (`user_id`,`report_id`);--> statement-breakpoint
CREATE INDEX `idx_report_likes_report` ON `report_likes` (`report_id`);--> statement-breakpoint
CREATE TABLE `report_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`user_id` text,
	`platform` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `danger_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "report_share_platform" CHECK("report_shares"."platform" in ('twitter','facebook','line','clipboard','other'))
);
--> statement-breakpoint
CREATE INDEX `idx_report_shares_report` ON `report_shares` (`report_id`);
--> statement-breakpoint
CREATE VIEW `danger_reports_public_preview` AS
SELECT
  id,
  title,
  description,
  danger_type,
  danger_level,
  status,
  round(latitude, 2) AS latitude,
  round(longitude, 2) AS longitude,
  prefecture,
  prefecture_code,
  city,
  municipality_code,
  town,
  postal_code,
  created_at,
  updated_at
FROM danger_reports
WHERE status IN ('approved', 'resolved', 'published');
--> statement-breakpoint
CREATE VIEW `report_stats` AS
SELECT
  dr.id AS report_id,
  dr.danger_type,
  dr.danger_level,
  dr.status,
  dr.created_at,
  count(DISTINCT rl.id) AS likes_count,
  count(DISTINCT rb.id) AS bookmarks_count,
  count(DISTINCT rc.id) AS comments_count,
  count(DISTINCT rs.id) AS shares_count
FROM danger_reports dr
LEFT JOIN report_likes rl ON dr.id = rl.report_id
LEFT JOIN report_bookmarks rb ON dr.id = rb.report_id
LEFT JOIN report_comments rc ON dr.id = rc.report_id
LEFT JOIN report_shares rs ON dr.id = rs.report_id
GROUP BY dr.id, dr.danger_type, dr.danger_level, dr.status, dr.created_at;
--> statement-breakpoint
CREATE VIEW `public_reports_with_stats` AS
SELECT
  dr.*,
  coalesce(rs.likes_count, 0) AS likes_count,
  coalesce(rs.bookmarks_count, 0) AS bookmarks_count,
  coalesce(rs.comments_count, 0) AS comments_count,
  coalesce(rs.shares_count, 0) AS shares_count
FROM danger_reports dr
LEFT JOIN report_stats rs ON dr.id = rs.report_id
WHERE dr.status = 'approved'
ORDER BY dr.created_at DESC;
--> statement-breakpoint
CREATE VIEW `danger_category_stats` AS
SELECT
  dr.danger_type,
  count(dr.id) AS total_reports,
  sum(CASE WHEN dr.created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days') THEN 1 ELSE 0 END) AS weekly_reports,
  sum(CASE WHEN dr.created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days') THEN 1 ELSE 0 END) AS monthly_reports,
  avg(dr.danger_level) AS avg_danger_level,
  max(dr.created_at) AS latest_report_at,
  count(DISTINCT rl.user_id) AS unique_likers,
  count(DISTINCT rb.user_id) AS unique_bookmarkers,
  count(DISTINCT rc.user_id) AS unique_commenters
FROM danger_reports dr
LEFT JOIN report_likes rl ON dr.id = rl.report_id
LEFT JOIN report_bookmarks rb ON dr.id = rb.report_id
LEFT JOIN report_comments rc ON dr.id = rc.report_id
WHERE dr.status = 'approved'
GROUP BY dr.danger_type;
