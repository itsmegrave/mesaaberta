CREATE TABLE "partner_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "partner_invitations_not_self" CHECK ("partner_invitations"."inviter_id" <> "partner_invitations"."invitee_id"),
	CONSTRAINT "partner_invitations_expiry" CHECK ("partner_invitations"."expires_at" > "partner_invitations"."created_at")
);
--> statement-breakpoint
ALTER TABLE "partner_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_owners" (
	"partner_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_owners_partner_id_profile_id_pk" PRIMARY KEY("partner_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "partner_owners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "partner_invitations" ADD CONSTRAINT "partner_invitations_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_invitations" ADD CONSTRAINT "partner_invitations_inviter_id_profiles_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_invitations" ADD CONSTRAINT "partner_invitations_invitee_id_profiles_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_owners" ADD CONSTRAINT "partner_owners_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_owners" ADD CONSTRAINT "partner_owners_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_invitations_pending_unique" ON "partner_invitations" USING btree ("partner_id","invitee_id") WHERE "partner_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "partner_invitations_partner_idx" ON "partner_invitations" USING btree ("partner_id","status");--> statement-breakpoint
CREATE INDEX "partner_invitations_invitee_idx" ON "partner_invitations" USING btree ("invitee_id","status");--> statement-breakpoint
CREATE INDEX "partner_owners_profile_idx" ON "partner_owners" USING btree ("profile_id");--> statement-breakpoint
-- Every partner sent so far is looked after by its submitter.
INSERT INTO "partner_owners" ("partner_id", "profile_id", "created_at") SELECT "id", "submitter_id", "created_at" FROM "partners" ON CONFLICT DO NOTHING;
