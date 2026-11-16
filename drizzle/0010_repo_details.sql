CREATE TABLE `repo_details` (
	`blip_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`stars` integer,
	`language` text,
	`topics` text DEFAULT '[]' NOT NULL,
	`license` text,
	`homepage` text,
	`pushed_at` integer,
	`archived` integer DEFAULT false NOT NULL,
	`lookup_status` text NOT NULL,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`blip_id`) REFERENCES `blips`(`id`) ON UPDATE no action ON DELETE cascade
);
