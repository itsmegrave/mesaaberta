CREATE TABLE "worker_heartbeats" (
	"name" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "worker_heartbeats" ENABLE ROW LEVEL SECURITY;