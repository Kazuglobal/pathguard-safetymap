CREATE TABLE `accident_hotspots` (
	`id` integer PRIMARY KEY NOT NULL,
	`dataset_version` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`radius_meters` integer NOT NULL,
	`min_year` integer NOT NULL,
	`max_year` integer NOT NULL,
	`accident_count` integer NOT NULL,
	`fatal_count` integer NOT NULL,
	`pedestrian_count` integer NOT NULL,
	`young_count` integer NOT NULL,
	`by_year_json` text NOT NULL,
	`by_class_json` text NOT NULL,
	`peak_hour` integer,
	`prefecture_code` integer NOT NULL,
	`municipality_code` text,
	`national_rank` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_accident_hotspots_version_lat_lng` ON `accident_hotspots` (`dataset_version`,`lat`,`lng`);