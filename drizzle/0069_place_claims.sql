CREATE TABLE "place_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"claimant_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"contact" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_claims_contact_length" CHECK (char_length("place_claims"."contact") BETWEEN 3 AND 120),
	CONSTRAINT "place_claims_note_length" CHECK (char_length("place_claims"."note") <= 500),
	CONSTRAINT "place_claims_decision_note_length" CHECK (char_length("place_claims"."decision_note") <= 1000),
	CONSTRAINT "place_claims_decided" CHECK (("place_claims"."status" = 'pending') = ("place_claims"."decided_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "place_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "place_claims" ADD CONSTRAINT "place_claims_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_claims" ADD CONSTRAINT "place_claims_claimant_id_profiles_id_fk" FOREIGN KEY ("claimant_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "place_claims_one_pending" ON "place_claims" USING btree ("place_id","claimant_id") WHERE "place_claims"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "place_claims_status_idx" ON "place_claims" USING btree ("status","created_at");