CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"actor_id" uuid,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"handled_by" text[] DEFAULT '{}'::text[] NOT NULL,
	"failed_at" timestamp with time zone,
	"claimed_until" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "events_pending_idx" ON "events" USING btree ("next_attempt_at") WHERE "events"."processed_at" IS NULL AND "events"."failed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "events_actor_idx" ON "events" USING btree ("actor_id","created_at");