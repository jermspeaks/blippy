CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blip_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `blips` ADD `title` text;--> statement-breakpoint
ALTER TABLE `blips` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `blips` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `blips` ADD `url` text;--> statement-breakpoint
ALTER TABLE `blips` ADD `site_name` text;--> statement-breakpoint
ALTER TABLE `blips` ADD `group_id` text REFERENCES blip_groups(id);