ALTER TABLE `spaces` ADD `kind` text DEFAULT 'general' NOT NULL;
--> statement-breakpoint
-- One-time sweep: if YouTube blips already exist, create a video space and store them there.
INSERT INTO `spaces` (`id`, `name`, `description`, `kind`, `auto_intake`, `created_at`)
SELECT 'video-space-default', 'Videos', 'Videos from links you''ve captured', 'video', 1, unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `spaces` WHERE `kind` = 'video')
  AND NOT EXISTS (SELECT 1 FROM `spaces` WHERE lower(`name`) = 'videos')
  AND EXISTS (SELECT 1 FROM `blips` WHERE `space_id` IS NULL AND `status` = 'active' AND (
    `url` LIKE '%youtube.com/watch?v=%' OR `url` LIKE '%youtu.be/%' OR `url` LIKE '%youtube.com/shorts/%' OR `url` LIKE '%youtube.com/live/%'));
--> statement-breakpoint
UPDATE `blips` SET `space_id` = (SELECT `id` FROM `spaces` WHERE `kind` = 'video' LIMIT 1), `updated_at` = unixepoch()
WHERE `space_id` IS NULL AND `status` = 'active'
  AND EXISTS (SELECT 1 FROM `spaces` WHERE `kind` = 'video')
  AND (`url` LIKE '%youtube.com/watch?v=%' OR `url` LIKE '%youtu.be/%' OR `url` LIKE '%youtube.com/shorts/%' OR `url` LIKE '%youtube.com/live/%');
