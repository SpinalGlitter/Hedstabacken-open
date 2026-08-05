CREATE TABLE `custom_sms_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`phone_number` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_message_id` text,
	`parts` integer,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `custom_sms_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_sms_deliveries_message_member_idx` ON `custom_sms_deliveries` (`message_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `custom_sms_deliveries_message_idx` ON `custom_sms_deliveries` (`message_id`);--> statement-breakpoint
CREATE TABLE `custom_sms_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_key` text NOT NULL,
	`admin_member_id` integer NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`recipient_count` integer DEFAULT 0 NOT NULL,
	`sent_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`admin_member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_sms_messages_request_key_idx` ON `custom_sms_messages` (`request_key`);--> statement-breakpoint
CREATE INDEX `custom_sms_messages_admin_idx` ON `custom_sms_messages` (`admin_member_id`,`created_at`);