ALTER TABLE "profile_social_links" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_social_links" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "profile_social_links" ADD CONSTRAINT "profile_social_links_target_check" CHECK ("profile_social_links"."handle" IS NOT NULL OR "profile_social_links"."url" IS NOT NULL);