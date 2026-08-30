UPDATE `fixtures`
SET `status` = 'FINISHED', `home_score` = 2, `away_score` = 2, `winner` = 'DRAW', `last_synced_at` = CURRENT_TIMESTAMP
WHERE `football_data_id` = 560552;
--> statement-breakpoint
UPDATE `fixtures`
SET `status` = 'FINISHED', `home_score` = 1, `away_score` = 1, `winner` = 'DRAW', `last_synced_at` = CURRENT_TIMESTAMP
WHERE `football_data_id` = 560560;
--> statement-breakpoint
UPDATE `fixtures`
SET `status` = 'FINISHED', `home_score` = 0, `away_score` = 1, `winner` = 'AWAY_TEAM', `last_synced_at` = CURRENT_TIMESTAMP
WHERE `football_data_id` = 560561;
--> statement-breakpoint
UPDATE `fixtures`
SET `status` = 'FINISHED', `home_score` = 0, `away_score` = 2, `winner` = 'AWAY_TEAM', `last_synced_at` = CURRENT_TIMESTAMP
WHERE `football_data_id` = 560558;
