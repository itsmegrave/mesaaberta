ALTER TABLE "profiles" ADD COLUMN "looking_for_table_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "looking_for_table_note" text;--> statement-breakpoint
CREATE INDEX "profiles_looking_for_table_idx" ON "profiles" USING btree ("looking_for_table_at") WHERE "profiles"."looking_for_table_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_looking_note_length" CHECK (char_length("profiles"."looking_for_table_note") <= 200);