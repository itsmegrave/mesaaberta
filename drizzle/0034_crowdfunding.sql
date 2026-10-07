CREATE TYPE "public"."crowdfunding_platform" AS ENUM('catarse', 'kickstarter', 'benfeitoria', 'gamefound', 'other');--> statement-breakpoint
ALTER TYPE "public"."report_reason" ADD VALUE 'broken_link';--> statement-breakpoint
ALTER TYPE "public"."report_reason" ADD VALUE 'scam';--> statement-breakpoint
ALTER TYPE "public"."report_reason" ADD VALUE 'off_topic';--> statement-breakpoint
ALTER TYPE "public"."report_target" ADD VALUE 'crowdfunding';--> statement-breakpoint
CREATE TABLE "crowdfundings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submitter_id" uuid NOT NULL,
	"url" text NOT NULL,
	"url_key" text NOT NULL,
	"platform" "crowdfunding_platform" NOT NULL,
	"name" text NOT NULL,
	"owner" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"image_path" text,
	"removed_at" timestamp with time zone,
	"removed_by" uuid,
	"removal_reason" "report_reason",
	"removal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crowdfundings_name_length" CHECK (char_length("crowdfundings"."name") BETWEEN 1 AND 120),
	CONSTRAINT "crowdfundings_owner_length" CHECK (char_length("crowdfundings"."owner") BETWEEN 1 AND 80),
	CONSTRAINT "crowdfundings_dates_order" CHECK ("crowdfundings"."ends_on" >= "crowdfundings"."starts_on"),
	CONSTRAINT "crowdfundings_removal_note_length" CHECK (char_length("crowdfundings"."removal_note") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "crowdfundings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "table_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "crowdfundings" ADD CONSTRAINT "crowdfundings_submitter_id_profiles_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crowdfundings_url_key_unique" ON "crowdfundings" USING btree ("url_key") WHERE "crowdfundings"."removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "crowdfundings_ends_on_idx" ON "crowdfundings" USING btree ("ends_on");--> statement-breakpoint
CREATE INDEX "crowdfundings_submitter_idx" ON "crowdfundings" USING btree ("submitter_id");--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_table_required" CHECK ("reports"."target_type" NOT IN ('table', 'player') OR "reports"."table_id" IS NOT NULL);