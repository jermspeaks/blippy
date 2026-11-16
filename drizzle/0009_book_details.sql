CREATE TABLE `book_details` (
	`blip_id` text PRIMARY KEY NOT NULL,
	`isbn13` text,
	`authors` text DEFAULT '[]' NOT NULL,
	`publisher` text,
	`published_year` integer,
	`page_count` integer,
	`lookup_status` text NOT NULL,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`blip_id`) REFERENCES `blips`(`id`) ON UPDATE no action ON DELETE cascade
);
