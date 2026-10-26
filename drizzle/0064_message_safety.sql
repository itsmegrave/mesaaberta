ALTER TYPE "public"."report_target" ADD VALUE 'message';--> statement-breakpoint
ALTER TYPE "public"."report_target" ADD VALUE 'person';--> statement-breakpoint
CREATE TABLE "profile_blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "profile_blocks_not_self" CHECK ("profile_blocks"."blocker_id" <> "profile_blocks"."blocked_id")
);
--> statement-breakpoint
ALTER TABLE "profile_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "excerpt" jsonb;--> statement-breakpoint
ALTER TABLE "profile_blocks" ADD CONSTRAINT "profile_blocks_blocker_id_profiles_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_blocks" ADD CONSTRAINT "profile_blocks_blocked_id_profiles_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_blocks_blocked_idx" ON "profile_blocks" USING btree ("blocked_id");--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_subject_id_profiles_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;