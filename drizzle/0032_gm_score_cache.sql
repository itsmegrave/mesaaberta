CREATE TABLE "gm_scores" (
	"gm_id" uuid PRIMARY KEY NOT NULL,
	"score" double precision,
	"count" integer DEFAULT 0 NOT NULL,
	"month" date NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"computed_version" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gm_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_registration_fk";
--> statement-breakpoint
ALTER TABLE "gm_scores" ADD CONSTRAINT "gm_scores_gm_id_profiles_id_fk" FOREIGN KEY ("gm_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_player_id_profiles_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- A rating was added, changed or removed: the GM's cached score is out of date. The row is created
-- when it does not exist yet (month 1970 never matches), so a GM's first rating is seen too. A
-- table that is going away (cascade) has no GM to look up, and nothing to refresh.
CREATE FUNCTION "gm_score_touch"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	gm uuid;
BEGIN
	SELECT "gm_id" INTO gm FROM "game_tables" WHERE "id" = COALESCE(NEW."table_id", OLD."table_id");
	IF gm IS NOT NULL THEN
		INSERT INTO "gm_scores" ("gm_id", "score", "count", "month", "version", "computed_version")
		VALUES (gm, NULL, 0, DATE '1970-01-01', 1, 0)
		ON CONFLICT ("gm_id") DO UPDATE SET "version" = "gm_scores"."version" + 1;
	END IF;
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "ratings_gm_score_touch"
AFTER INSERT OR DELETE OR UPDATE OF "gm_score", "updated_at" ON "ratings"
FOR EACH ROW EXECUTE FUNCTION "gm_score_touch"();
