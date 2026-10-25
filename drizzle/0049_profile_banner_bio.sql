ALTER TABLE "profiles" ADD COLUMN "banner_path" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_bio_length" CHECK (char_length("profiles"."bio") <= 300);