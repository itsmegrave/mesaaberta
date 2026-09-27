CREATE TYPE "public"."table_modality" AS ENUM('online', 'in_person');--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "modality" "table_modality" DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "location_area" text;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "join_details" text;--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_in_person_has_area" CHECK ("game_tables"."modality" = 'online' OR "game_tables"."location_area" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_location_area_length" CHECK (char_length("game_tables"."location_area") <= 120);--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_join_details_length" CHECK (char_length("game_tables"."join_details") <= 1000);