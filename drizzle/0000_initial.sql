CREATE TYPE "public"."join_mode" AS ENUM('auto', 'approval');--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."table_kind" AS ENUM('campaign', 'one_shot');--> statement-breakpoint
CREATE TYPE "public"."table_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "game_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"join_mode" "join_mode" DEFAULT 'auto' NOT NULL,
	"system" text NOT NULL,
	"title" text NOT NULL,
	"image_path" text,
	"description" text DEFAULT '' NOT NULL,
	"extra_info" text,
	"kind" "table_kind" NOT NULL,
	"capacity" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"timezone" text NOT NULL,
	"recurrence" text,
	"until" timestamp with time zone,
	"status" "table_status" DEFAULT 'active' NOT NULL,
	"ical_sequence" integer DEFAULT 0 NOT NULL,
	"gm_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_tables_recurrence_matches_kind" CHECK (("game_tables"."kind" = 'one_shot' AND "game_tables"."recurrence" IS NULL) OR ("game_tables"."kind" = 'campaign' AND "game_tables"."recurrence" IS NOT NULL)),
	CONSTRAINT "game_tables_capacity_positive" CHECK ("game_tables"."capacity" > 0),
	CONSTRAINT "game_tables_duration_positive" CHECK ("game_tables"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"role" "profile_role" DEFAULT 'member' NOT NULL,
	"status" "profile_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_gm_id_profiles_id_fk" FOREIGN KEY ("gm_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_tables_slug_unique" ON "game_tables" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "game_tables_gm_id_idx" ON "game_tables" USING btree ("gm_id");