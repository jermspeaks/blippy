CREATE TABLE `blips` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`category_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`next_review_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
