ALTER TABLE "game_tables" DROP CONSTRAINT "game_tables_recurrence_matches_kind";--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_recurrence_matches_kind" CHECK (("game_tables"."kind" IN ('one_shot', 'adventure') AND "game_tables"."recurrence" IS NULL) OR ("game_tables"."kind" = 'campaign' AND "game_tables"."recurrence" IS NOT NULL));
