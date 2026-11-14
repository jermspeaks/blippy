CREATE TABLE `routing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern` text NOT NULL,
	`space_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routing_rules_pattern_unique` ON `routing_rules` (`pattern`);