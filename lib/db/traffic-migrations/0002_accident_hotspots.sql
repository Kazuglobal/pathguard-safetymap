-- 事故多発地点（警察庁「事故多発地点解析ツール」の距離グループ集計と同じ考え方で事前計算した結果）
-- 生成: scripts/migrate/build-traffic-hotspots.ts。アプリは HOTSPOT_DATASET_VERSION の行だけを読む。
-- 本番に 0000/0001 が migrations 経由で適用済みか不明なため、--file で単体適用しても安全なよう IF NOT EXISTS にしている。
CREATE TABLE IF NOT EXISTS `accident_hotspots` (
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
CREATE INDEX IF NOT EXISTS `idx_accident_hotspots_version_lat_lng` ON `accident_hotspots` (`dataset_version`,`lat`,`lng`);
