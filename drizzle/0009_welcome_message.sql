ALTER TABLE "game_tables" ADD COLUMN "welcome_message" text;--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_welcome_message_length" CHECK (char_length("game_tables"."welcome_message") <= 1000);
