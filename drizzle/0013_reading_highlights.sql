CREATE TABLE `reading_highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`reading_item_id` text NOT NULL,
	`exact` text NOT NULL,
	`prefix` text DEFAULT '' NOT NULL,
	`suffix` text DEFAULT '' NOT NULL,
	`note` text,
	`color` text DEFAULT 'yellow' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reading_item_id`) REFERENCES `reading_items`(`id`) ON UPDATE no action ON DELETE cascade
);
