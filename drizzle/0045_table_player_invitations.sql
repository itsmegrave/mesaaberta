CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "gm_invite_blocks" (
	"player_id" uuid NOT NULL,
	"gm_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gm_invite_blocks_player_id_gm_id_pk" PRIMARY KEY("player_id","gm_id"),
	CONSTRAINT "gm_invite_blocks_not_self" CHECK ("gm_invite_blocks"."player_id" <> "gm_invite_blocks"."gm_id")
);
--> statement-breakpoint
ALTER TABLE "gm_invite_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "player_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"gm_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"cancellation_reason" text,
	CONSTRAINT "player_invitations_not_self" CHECK ("player_invitations"."gm_id" <> "player_invitations"."player_id"),
	CONSTRAINT "player_invitations_expiry" CHECK ("player_invitations"."expires_at" > "player_invitations"."created_at")
);
--> statement-breakpoint
ALTER TABLE "player_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "invitations_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "gm_invite_blocks" ADD CONSTRAINT "gm_invite_blocks_player_id_profiles_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gm_invite_blocks" ADD CONSTRAINT "gm_invite_blocks_gm_id_profiles_id_fk" FOREIGN KEY ("gm_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_gm_id_profiles_id_fk" FOREIGN KEY ("gm_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_player_id_profiles_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_invitations_pending_unique" ON "player_invitations" USING btree ("table_id","player_id") WHERE "player_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "player_invitations_table_status_idx" ON "player_invitations" USING btree ("table_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "player_invitations_player_idx" ON "player_invitations" USING btree ("player_id","status");--> statement-breakpoint
CREATE INDEX "player_invitations_gm_created_idx" ON "player_invitations" USING btree ("gm_id","created_at");