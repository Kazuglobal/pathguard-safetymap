-- UIUX改装グループ2(個人情報を預からない設計)で使う、後方互換の追加だけのマイグレーション。
-- 表の作り直しは無い。古いコードはこれらの列・表を読まないので、マージ前に本番へ先に適用してよい。
-- (drizzle-kit generate が出した学区まわりの CREATE TABLE は、手書きマイグレーション
--  20261010090000_school_district_alerts.sql で本番に作成済みの表の重複なので削除した)
CREATE TABLE `children` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nickname` text NOT NULL,
	`grade` integer,
	`school_district_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "children_nickname_length" CHECK(length("children"."nickname") between 1 and 20),
	CONSTRAINT "children_grade" CHECK("children"."grade" is null or "children"."grade" between 1 and 6)
);
--> statement-breakpoint
CREATE INDEX `idx_children_user` ON `children` (`user_id`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `location_precision` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `danger_reports` ADD `human_approved_at` text;--> statement-breakpoint
ALTER TABLE `danger_reports` ADD `image_masked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `report_images` ADD `masked` integer DEFAULT false NOT NULL;
