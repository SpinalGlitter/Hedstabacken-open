CREATE TABLE `member_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_sessions_token_hash_idx` ON `member_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `member_sessions_member_idx` ON `member_sessions` (`member_id`);