CREATE TABLE `reading_items` (
	`id` text PRIMARY KEY NOT NULL,
	`blip_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`byline` text,
	`site_name` text,
	`lead_image_url` text,
	`excerpt` text,
	`content_html` text,
	`word_count` integer,
	`reading_minutes` integer,
	`extract_status` text NOT NULL,
	`extract_error` text,
	`status` text DEFAULT 'unread' NOT NULL,
	`added_at` integer NOT NULL,
	`read_at` integer,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`blip_id`) REFERENCES `blips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_items_blip_id_unique` ON `reading_items` (`blip_id`);