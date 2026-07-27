ALTER TABLE `family_members` ADD `login_name` text NOT NULL;--> statement-breakpoint
ALTER TABLE `family_members` ADD `pin_code` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `family_members_login_name_idx` ON `family_members` (`login_name`);