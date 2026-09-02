ALTER TABLE `hazard_detections` ADD `kind` text;--> statement-breakpoint
ALTER TABLE `hazard_detections` ADD `accident_link` text;--> statement-breakpoint
CREATE INDEX `idx_hazard_detections_kind` ON `hazard_detections` (`kind`);