CREATE TABLE "place_host_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "place_host_invitations_expiry" CHECK ("place_host_invitations"."expires_at" > "place_host_invitations"."created_at")
);
--> statement-breakpoint
ALTER TABLE "place_host_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "place_hosts" (
	"place_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_hosts_place_id_profile_id_pk" PRIMARY KEY("place_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "place_hosts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "place_host_invitations" ADD CONSTRAINT "place_host_invitations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_host_invitations" ADD CONSTRAINT "place_host_invitations_inviter_id_profiles_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_host_invitations" ADD CONSTRAINT "place_host_invitations_invitee_id_profiles_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hosts" ADD CONSTRAINT "place_hosts_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hosts" ADD CONSTRAINT "place_hosts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "place_host_invitations_pending_unique" ON "place_host_invitations" USING btree ("place_id","invitee_id") WHERE "place_host_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "place_host_invitations_place_idx" ON "place_host_invitations" USING btree ("place_id","status");--> statement-breakpoint
CREATE INDEX "place_host_invitations_invitee_idx" ON "place_host_invitations" USING btree ("invitee_id","status");--> statement-breakpoint
CREATE INDEX "place_host_invitations_inviter_idx" ON "place_host_invitations" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "place_hosts_profile_idx" ON "place_hosts" USING btree ("profile_id");