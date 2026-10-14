CREATE TABLE "password_setup_codes" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_setup_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "password_setup_codes" ADD CONSTRAINT "password_setup_codes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;