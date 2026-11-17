CREATE TYPE "public"."place_kind" AS ENUM('store', 'game_cafe', 'club', 'bar', 'cultural_space', 'other');--> statement-breakpoint
ALTER TYPE "public"."report_reason" ADD VALUE 'place_closed';--> statement-breakpoint
ALTER TYPE "public"."report_reason" ADD VALUE 'wrong_address';--> statement-breakpoint
ALTER TYPE "public"."report_reason" ADD VALUE 'not_public';--> statement-breakpoint
ALTER TYPE "public"."report_target" ADD VALUE 'place';--> statement-breakpoint
CREATE TABLE "place_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"network" text NOT NULL,
	"url" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "place_links_network" CHECK ("place_links"."network" <> 'website')
);
--> statement-breakpoint
ALTER TABLE "place_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "place_tags" (
	"place_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "place_tags_place_id_kind_slug_pk" PRIMARY KEY("place_id","kind","slug")
);
--> statement-breakpoint
ALTER TABLE "place_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"submitter_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "place_kind" NOT NULL,
	"description" text,
	"postal_code" text NOT NULL,
	"street" text NOT NULL,
	"complement" text,
	"neighbourhood" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"opening_hours" text,
	"amenities" text[] DEFAULT '{}'::text[] NOT NULL,
	"site_url" text,
	"image_path" text,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"owner_id" uuid,
	"owner_since" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"hidden_reason" text,
	"removed_at" timestamp with time zone,
	"removed_by" uuid,
	"removal_reason" "report_reason",
	"removal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_slug_format" CHECK ("places"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "places_postal_code_format" CHECK ("places"."postal_code" ~ '^[0-9]{8}$'),
	CONSTRAINT "places_state_format" CHECK ("places"."state" ~ '^[A-Z]{2}$'),
	CONSTRAINT "places_name_length" CHECK (char_length("places"."name") BETWEEN 1 AND 80),
	CONSTRAINT "places_description_length" CHECK (char_length("places"."description") <= 280),
	CONSTRAINT "places_street_length" CHECK (char_length("places"."street") BETWEEN 1 AND 120),
	CONSTRAINT "places_complement_length" CHECK (char_length("places"."complement") <= 60),
	CONSTRAINT "places_opening_hours_length" CHECK (char_length("places"."opening_hours") <= 120),
	CONSTRAINT "places_amenities_known" CHECK ("places"."amenities" <@ ARRAY['accessible', 'lends_games', 'bookable_tables', 'free_to_play', 'sells_food', 'open_late']::text[]),
	CONSTRAINT "places_owner_since" CHECK (("places"."owner_id" IS NULL) = ("places"."owner_since" IS NULL)),
	CONSTRAINT "places_hidden_reason" CHECK (("places"."hidden_at" IS NULL) = ("places"."hidden_reason" IS NULL)),
	CONSTRAINT "places_removal_note_length" CHECK (char_length("places"."removal_note") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "places" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "place_id" uuid;--> statement-breakpoint
ALTER TABLE "place_links" ADD CONSTRAINT "place_links_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_tags" ADD CONSTRAINT "place_tags_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_submitter_id_profiles_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_links_place_idx" ON "place_links" USING btree ("place_id","position");--> statement-breakpoint
CREATE INDEX "place_tags_filter_idx" ON "place_tags" USING btree ("kind","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "places_slug_unique" ON "places" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "places_name_cep_unique" ON "places" USING btree (lower("name"),"postal_code") WHERE "places"."removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "places_submitter_idx" ON "places" USING btree ("submitter_id");--> statement-breakpoint
CREATE INDEX "places_owner_idx" ON "places" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "places_location_idx" ON "places" USING btree ("state","city");--> statement-breakpoint
CREATE INDEX "places_approved_idx" ON "places" USING btree ("approved_at","removed_at");--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_tables_place_idx" ON "game_tables" USING btree ("place_id");