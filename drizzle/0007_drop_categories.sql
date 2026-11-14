PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_blips` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`title` text,
	`summary` text,
	`image_url` text,
	`url` text,
	`site_name` text,
	`group_id` text,
	`space_id` text,
	`routed_by` text,
	`routed_reason` text,
	`status` text DEFAULT 'active' NOT NULL,
	`next_review_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `blip_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_blips`("id", "content", "title", "summary", "image_url", "url", "site_name", "group_id", "space_id", "routed_by", "routed_reason", "status", "next_review_at", "created_at", "updated_at") SELECT "id", "content", "title", "summary", "image_url", "url", "site_name", "group_id", "space_id", "routed_by", "routed_reason", "status", "next_review_at", "created_at", "updated_at" FROM `blips`;--> statement-breakpoint
DROP TABLE `blips`;--> statement-breakpoint
ALTER TABLE `__new_blips` RENAME TO `blips`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
DROP TABLE `categories`;
