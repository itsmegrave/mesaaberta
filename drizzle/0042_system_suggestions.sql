ALTER TABLE "systems" ALTER COLUMN "position" SET DEFAULT 1000;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "status" "catalog_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "suggested_by" uuid;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "merged_into" uuid;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_suggested_by_profiles_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;