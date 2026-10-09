ALTER TYPE "public"."report_reason" ADD VALUE 'no_backlink';--> statement-breakpoint
ALTER TYPE "public"."report_target" ADD VALUE 'partner';--> statement-breakpoint
CREATE TABLE "partner_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"network" text NOT NULL,
	"url" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "partner_links_network" CHECK ("partner_links"."network" <> 'website')
);
--> statement-breakpoint
ALTER TABLE "partner_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submitter_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo_path" text NOT NULL,
	"site_url" text,
	"backlink_url" text,
	"coupon_code" text,
	"coupon_description" text,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"removed_at" timestamp with time zone,
	"removed_by" uuid,
	"removal_reason" "report_reason",
	"removal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_name_length" CHECK (char_length("partners"."name") BETWEEN 1 AND 60),
	CONSTRAINT "partners_description_length" CHECK (char_length("partners"."description") <= 140),
	CONSTRAINT "partners_coupon_code_length" CHECK (char_length("partners"."coupon_code") BETWEEN 1 AND 32),
	CONSTRAINT "partners_coupon_description_length" CHECK (char_length("partners"."coupon_description") <= 140),
	CONSTRAINT "partners_coupon_description_needs_code" CHECK ("partners"."coupon_description" IS NULL OR "partners"."coupon_code" IS NOT NULL),
	CONSTRAINT "partners_removal_note_length" CHECK (char_length("partners"."removal_note") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "partners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "partner_links" ADD CONSTRAINT "partner_links_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_submitter_id_profiles_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_links_partner_idx" ON "partner_links" USING btree ("partner_id","position");--> statement-breakpoint
CREATE INDEX "partners_submitter_idx" ON "partners" USING btree ("submitter_id");--> statement-breakpoint
CREATE INDEX "partners_approved_idx" ON "partners" USING btree ("approved_at","removed_at");--> statement-breakpoint
-- Partner logos go to the profile-avatars bucket under `partners/<submitter id>/`: each person writes,
-- replaces and deletes only inside their own folder. Same rules as 0018_storage_policies.sql: skipped
-- where Supabase's `storage` schema does not exist, replaced when already there, and a notice instead
-- of a failed deploy when the role may not change `storage.objects`.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "users manage their own partner logos" ON storage.objects';
    EXECUTE $sql$
      CREATE POLICY "users manage their own partner logos" ON storage.objects
        FOR ALL TO authenticated
        USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = 'partners' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text)
        WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = 'partners' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text)
    $sql$;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'partner logo storage policy not applied (%): run this migration''s SQL in the Supabase SQL editor', SQLERRM;
  END;
END $$;
