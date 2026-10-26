ALTER TABLE "game_tables" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "game_tables_status_published_idx" ON "game_tables" USING btree ("status","published_at");--> statement-breakpoint
-- Tables that are already public count from when they were created; a draft gets its date when it is published.
UPDATE "game_tables" SET "published_at" = "created_at" WHERE "status" <> 'draft' AND "published_at" IS NULL;
