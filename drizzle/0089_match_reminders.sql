ALTER TABLE "matches" ADD COLUMN "reminders" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "reminded_at" timestamp with time zone;