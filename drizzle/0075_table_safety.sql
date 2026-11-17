ALTER TABLE "game_tables" ADD COLUMN "safety_tools" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "content_rating" text;--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_content_rating_value" CHECK ("game_tables"."content_rating" IS NULL OR "game_tables"."content_rating" IN ('L', '10', '12', '14', '16', '18'));