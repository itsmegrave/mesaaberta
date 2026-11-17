CREATE TYPE "public"."table_session_status" AS ENUM('scheduled', 'held', 'not_held', 'cancelled');--> statement-breakpoint
CREATE TABLE "table_session_attendance" (
	"session_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"attended" boolean NOT NULL,
	CONSTRAINT "table_session_attendance_session_id_player_id_pk" PRIMARY KEY("session_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "table_session_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"status" "table_session_status" DEFAULT 'scheduled' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_sessions_duration_positive" CHECK ("table_sessions"."duration_minutes" > 0),
	CONSTRAINT "table_sessions_note_length" CHECK (char_length("table_sessions"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "table_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "table_session_attendance" ADD CONSTRAINT "table_session_attendance_session_id_table_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_session_attendance" ADD CONSTRAINT "table_session_attendance_player_id_profiles_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "table_session_attendance_player_idx" ON "table_session_attendance" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "table_sessions_table_idx" ON "table_sessions" USING btree ("table_id","starts_at");--> statement-breakpoint
-- Every table still going gets its next session as the first row; nothing before is recovered.
INSERT INTO "table_sessions" ("table_id", "starts_at", "duration_minutes", "status")
SELECT "id", "starts_at", "duration_minutes", 'scheduled'
FROM "game_tables"
WHERE "status" IN ('active', 'awaiting_confirmation', 'draft');
