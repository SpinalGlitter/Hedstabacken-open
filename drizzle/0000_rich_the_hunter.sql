CREATE TABLE `family_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'player' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_members_email_idx` ON `family_members` (`email`);--> statement-breakpoint
CREATE TABLE `fixture_corrections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixture_id` integer NOT NULL,
	`admin_member_id` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`football_data_id` integer NOT NULL,
	`season_id` integer NOT NULL,
	`matchday` integer NOT NULL,
	`utc_date` text NOT NULL,
	`home_team` text NOT NULL,
	`away_team` text NOT NULL,
	`status` text NOT NULL,
	`home_score` integer,
	`away_score` integer,
	`winner` text,
	`last_synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fixtures_football_data_id_idx` ON `fixtures` (`football_data_id`);--> statement-breakpoint
CREATE INDEX `fixtures_matchday_idx` ON `fixtures` (`season_id`,`matchday`);--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`fixture_id` integer NOT NULL,
	`pick` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `predictions_member_fixture_idx` ON `predictions` (`member_id`,`fixture_id`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_code` text DEFAULT 'PL' NOT NULL,
	`start_year` integer NOT NULL,
	`label` text NOT NULL,
	`current_matchday` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
