CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'inappropriate_content', 'no_show', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('table', 'player');--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "report_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_details_length" CHECK (char_length("reports"."details") <= 1000),
	CONSTRAINT "reports_resolution_note_length" CHECK (char_length("reports"."resolution_note") <= 1000),
	CONSTRAINT "reports_table_target" CHECK ("reports"."target_type" <> 'table' OR "reports"."target_id" = "reports"."table_id")
);
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "moderation_note" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banned_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_unique" ON "reports" USING btree ("reporter_id","target_type","target_id") WHERE "reports"."status" IN ('open', 'reviewing');--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "profiles_banned_until_idx" ON "profiles" USING btree ("banned_until") WHERE "profiles"."banned_until" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_moderation_note_length" CHECK (char_length("game_tables"."moderation_note") <= 1000);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_ban_reason_length" CHECK (char_length("profiles"."ban_reason") <= 1000);