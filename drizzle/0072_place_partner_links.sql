CREATE TABLE "partner_shown_gms" (
	"partner_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_shown_gms_partner_id_profile_id_pk" PRIMARY KEY("partner_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "partner_shown_gms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "place_partner_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"requested_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_partner_links_decision_note_length" CHECK (char_length("place_partner_links"."decision_note") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "place_partner_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "partner_shown_gms" ADD CONSTRAINT "partner_shown_gms_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_shown_gms" ADD CONSTRAINT "partner_shown_gms_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_partner_links" ADD CONSTRAINT "place_partner_links_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_partner_links" ADD CONSTRAINT "place_partner_links_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_partner_links" ADD CONSTRAINT "place_partner_links_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_shown_gms_profile_idx" ON "partner_shown_gms" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "place_partner_links_one_pending" ON "place_partner_links" USING btree ("place_id") WHERE "place_partner_links"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "place_partner_links_one_approved" ON "place_partner_links" USING btree ("place_id") WHERE "place_partner_links"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "place_partner_links_partner_idx" ON "place_partner_links" USING btree ("partner_id","status");--> statement-breakpoint
CREATE INDEX "place_partner_links_status_idx" ON "place_partner_links" USING btree ("status","created_at");