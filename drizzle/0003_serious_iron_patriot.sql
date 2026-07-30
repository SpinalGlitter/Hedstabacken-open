CREATE TABLE `round_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`matchday` integer NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `round_notifications_season_matchday_idx` ON `round_notifications` (`season_id`,`matchday`);--> statement-breakpoint
CREATE TABLE `sms_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notification_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`phone_number` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_message_id` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`notification_id`) REFERENCES `round_notifications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sms_deliveries_notification_member_idx` ON `sms_deliveries` (`notification_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `sms_deliveries_notification_idx` ON `sms_deliveries` (`notification_id`);--> statement-breakpoint
ALTER TABLE `family_members` ADD `phone_number` text;--> statement-breakpoint
ALTER TABLE `family_members` ADD `sms_opt_in` integer DEFAULT false NOT NULL;