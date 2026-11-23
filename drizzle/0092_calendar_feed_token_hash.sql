ALTER TABLE "profiles" ADD COLUMN "calendar_feed_token_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_calendar_feed_token_hash_unique" ON "profiles" USING btree ("calendar_feed_token_hash");--> statement-breakpoint
-- Existing feeds keep their address: their hash is filled in here. The plain column stays while the
-- previous release may still be running (expand, then contract in a later migration).
UPDATE "profiles" SET "calendar_feed_token_hash" = encode(sha256(convert_to("calendar_feed_token", 'UTF8')), 'hex') WHERE "calendar_feed_token" IS NOT NULL;
