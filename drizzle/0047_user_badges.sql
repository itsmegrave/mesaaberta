ALTER TYPE "public"."notification_category" ADD VALUE 'achievements';--> statement-breakpoint
CREATE TABLE "user_badges" (
	"profile_id" uuid NOT NULL,
	"badge_id" text NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_event_id" uuid,
	"granted_by" uuid,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"hidden" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_badges_profile_id_badge_id_pk" PRIMARY KEY("profile_id","badge_id"),
	CONSTRAINT "user_badges_badge_id_format" CHECK ("user_badges"."badge_id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "user_badges_revoke_reason" CHECK ("user_badges"."revoke_reason" IS NULL OR ("user_badges"."revoked_at" IS NOT NULL AND char_length("user_badges"."revoke_reason") <= 1000))
);
--> statement-breakpoint
ALTER TABLE "user_badges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_granted_by_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_badges_badge_idx" ON "user_badges" USING btree ("badge_id");