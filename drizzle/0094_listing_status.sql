ALTER TABLE "crowdfundings" ADD COLUMN "status" text DEFAULT 'listed' NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "crowdfundings" ADD CONSTRAINT "crowdfundings_status" CHECK ("crowdfundings"."status" IN ('listed','removed'));--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_status" CHECK ("partners"."status" IN ('pending','approved','removed'));--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_status" CHECK ("places"."status" IN ('pending','approved','removed'));--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_status" CHECK ("tools"."status" IN ('pending','approved','removed'));--> statement-breakpoint
-- Backfill from the timestamps. The reads still use the timestamps; the release that moves them to
-- `status` runs this backfill again first, for rows the previous code wrote during the deploy.
UPDATE "crowdfundings" SET "status" = 'removed' WHERE "removed_at" IS NOT NULL;--> statement-breakpoint
UPDATE "partners" SET "status" = CASE WHEN "removed_at" IS NOT NULL THEN 'removed' WHEN "approved_at" IS NOT NULL THEN 'approved' ELSE 'pending' END;--> statement-breakpoint
UPDATE "tools" SET "status" = CASE WHEN "removed_at" IS NOT NULL THEN 'removed' WHEN "approved_at" IS NOT NULL THEN 'approved' ELSE 'pending' END;--> statement-breakpoint
UPDATE "places" SET "status" = CASE WHEN "removed_at" IS NOT NULL THEN 'removed' WHEN "approved_at" IS NOT NULL THEN 'approved' ELSE 'pending' END;
