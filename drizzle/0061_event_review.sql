CREATE TYPE "public"."event_review" AS ENUM('seen', 'ignored', 'fixed');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "review_status" "event_review";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reviewed_at" timestamp with time zone;