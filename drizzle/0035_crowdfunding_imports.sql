ALTER TYPE "public"."crowdfunding_platform" ADD VALUE 'meeplestarter' BEFORE 'kickstarter';--> statement-breakpoint
CREATE TABLE "crowdfunding_import_runs" (
	"source" text NOT NULL,
	"run_date" date NOT NULL,
	"status" text NOT NULL,
	"token" uuid NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"cursor" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"counters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	CONSTRAINT "crowdfunding_import_runs_source_run_date_pk" PRIMARY KEY("source","run_date"),
	CONSTRAINT "crowdfunding_import_runs_source" CHECK ("crowdfunding_import_runs"."source" IN ('catarse','meeplestarter')),
	CONSTRAINT "crowdfunding_import_runs_status" CHECK ("crowdfunding_import_runs"."status" IN ('running','complete','partial','failed'))
);
--> statement-breakpoint
ALTER TABLE "crowdfunding_import_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "crowdfunding_imports" (
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"crowdfunding_id" uuid NOT NULL,
	"canonical_url" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crowdfunding_imports_source_external_id_pk" PRIMARY KEY("source","external_id"),
	CONSTRAINT "crowdfunding_imports_source" CHECK ("crowdfunding_imports"."source" IN ('catarse','meeplestarter'))
);
--> statement-breakpoint
ALTER TABLE "crowdfunding_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "crowdfundings" ALTER COLUMN "submitter_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "crowdfundings" ADD COLUMN "origin" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "crowdfundings" ADD COLUMN "import_source" text;--> statement-breakpoint
ALTER TABLE "crowdfunding_imports" ADD CONSTRAINT "crowdfunding_imports_crowdfunding_id_crowdfundings_id_fk" FOREIGN KEY ("crowdfunding_id") REFERENCES "public"."crowdfundings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crowdfunding_imports_campaign_idx" ON "crowdfunding_imports" USING btree ("crowdfunding_id");--> statement-breakpoint
CREATE INDEX "crowdfundings_url_all_idx" ON "crowdfundings" USING btree ("url");--> statement-breakpoint
ALTER TABLE "crowdfundings" ADD CONSTRAINT "crowdfundings_origin" CHECK (("crowdfundings"."origin" = 'member' AND "crowdfundings"."submitter_id" IS NOT NULL AND "crowdfundings"."import_source" IS NULL) OR ("crowdfundings"."origin" = 'import' AND "crowdfundings"."submitter_id" IS NULL AND "crowdfundings"."import_source" IS NOT NULL AND "crowdfundings"."import_source" IN ('catarse', 'meeplestarter')));