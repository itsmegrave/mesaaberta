ALTER TABLE "profiles" ADD COLUMN "calendar_feed_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_calendar_feed_token_unique" ON "profiles" USING btree ("calendar_feed_token");