CREATE TABLE `routing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`blip_id` text NOT NULL,
	`blip_title` text NOT NULL,
	`url` text,
	`space_id` text,
	`space_name` text,
	`routed_by` text,
	`reason` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `blips` ADD `routed_reason` text;