-- Drizzle applies pending migrations in one transaction. Compare text so the new enum
-- value can be referenced before the transaction adding it commits (Postgres 55P04).
ALTER TABLE "game_tables" DROP CONSTRAINT "game_tables_recurrence_matches_kind";--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_recurrence_matches_kind" CHECK (("game_tables"."kind"::text IN ('one_shot', 'adventure') AND "game_tables"."recurrence" IS NULL) OR ("game_tables"."kind"::text = 'campaign' AND "game_tables"."recurrence" IS NOT NULL));
