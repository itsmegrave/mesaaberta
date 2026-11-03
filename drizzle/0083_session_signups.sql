CREATE TYPE "public"."session_signup_status" AS ENUM('going', 'waiting');--> statement-breakpoint
CREATE TABLE "table_session_signups" (
	"session_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"status" "session_signup_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_session_signups_session_id_player_id_pk" PRIMARY KEY("session_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "table_session_signups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "table_session_signups" ADD CONSTRAINT "table_session_signups_session_id_table_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_session_signups" ADD CONSTRAINT "table_session_signups_player_id_profiles_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_session_signups" ADD CONSTRAINT "table_session_signups_table_id_player_id_registrations_table_id_player_id_fk" FOREIGN KEY ("table_id","player_id") REFERENCES "public"."registrations"("table_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "table_session_signups_table_player_idx" ON "table_session_signups" USING btree ("table_id","player_id");