ALTER TABLE "table_sessions" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD COLUMN "moved_from" timestamp with time zone;