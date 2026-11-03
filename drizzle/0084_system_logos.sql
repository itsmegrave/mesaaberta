CREATE TYPE "public"."system_logo_status" AS ENUM('pending', 'approved', 'rejected', 'missing');--> statement-breakpoint
CREATE TABLE "system_logos" (
	"system_id" uuid PRIMARY KEY NOT NULL,
	"status" "system_logo_status" NOT NULL,
	"path" text,
	"method" text,
	"confidence" text,
	"image_url" text,
	"source_page" text,
	"attribution" text,
	"license" text,
	"note" text,
	"wikidata_id" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_logos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "system_logos" ADD CONSTRAINT "system_logos_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logos" ADD CONSTRAINT "system_logos_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "system_logos_status_idx" ON "system_logos" USING btree ("status");