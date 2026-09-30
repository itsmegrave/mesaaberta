CREATE TABLE "instagram_accounts" (
	"id" text PRIMARY KEY DEFAULT 'mesaaberta' NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instagram_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "instagram_posts" (
	"table_id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"caption" text,
	"asset_key" uuid DEFAULT gen_random_uuid() NOT NULL,
	"image" text,
	"asset_expires_at" timestamp with time zone,
	"account_id" text,
	"container_id" text,
	"media_id" text,
	"permalink" text,
	"last_error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_posts_status" CHECK ("instagram_posts"."status" IN ('queued', 'processing', 'publishing', 'published', 'failed', 'uncertain', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "instagram_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "instagram_posts" ADD CONSTRAINT "instagram_posts_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_posts_asset_idx" ON "instagram_posts" USING btree ("asset_key");