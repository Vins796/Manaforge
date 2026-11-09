CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cost` text NOT NULL,
	`mana_value` integer NOT NULL,
	`type_line` text NOT NULL,
	`rules_text` text DEFAULT '' NOT NULL,
	`affinities` text NOT NULL,
	`affinity_identity` text NOT NULL,
	`power` integer,
	`toughness` integer,
	`keywords` text DEFAULT '[]' NOT NULL,
	`rarity` text NOT NULL,
	`art_seed` text NOT NULL,
	`local_image_normal_path` text,
	`local_image_crop_path` text,
	`catalog_version` text NOT NULL,
	CONSTRAINT "cards_mana_value_check" CHECK("cards"."mana_value" >= 0),
	CONSTRAINT "cards_rarity_check" CHECK("cards"."rarity" IN ('comune', 'non_comune', 'rara', 'mitica'))
);
--> statement-breakpoint
CREATE INDEX `cards_name_idx` ON `cards` (`name`);--> statement-breakpoint
CREATE INDEX `cards_mana_value_idx` ON `cards` (`mana_value`);--> statement-breakpoint
CREATE INDEX `cards_type_line_idx` ON `cards` (`type_line`);--> statement-breakpoint
CREATE TABLE `deck_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
	`card_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`board` text DEFAULT 'main' NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "deck_cards_quantity_check" CHECK("deck_cards"."quantity" > 0),
	CONSTRAINT "deck_cards_board_check" CHECK("deck_cards"."board" IN ('main', 'sideboard'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deck_cards_deck_card_board_unique` ON `deck_cards` (`deck_id`,`card_id`,`board`);--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`format` text DEFAULT 'standard' NOT NULL,
	`cover_card_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cover_card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "decks_name_length_check" CHECK(length("decks"."name") BETWEEN 1 AND 40)
);
--> statement-breakpoint
CREATE INDEX `decks_user_id_idx` ON `decks` (`user_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`host_user_id` text NOT NULL,
	`guest_user_id` text,
	`mode` text NOT NULL,
	`winner_user_id` text,
	`played_at` integer NOT NULL,
	FOREIGN KEY (`host_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "matches_mode_check" CHECK("matches"."mode" IN ('bot', 'p2p'))
);
--> statement-breakpoint
CREATE INDEX `matches_host_user_id_idx` ON `matches` (`host_user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text,
	`google_id` text,
	`avatar` text DEFAULT 'forgiatore' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);