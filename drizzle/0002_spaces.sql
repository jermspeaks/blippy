CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`auto_intake` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `blip_groups` ADD `space_id` text REFERENCES spaces(id);--> statement-breakpoint
ALTER TABLE `blips` ADD `space_id` text REFERENCES spaces(id);