CREATE TYPE "public"."poll_choice" AS ENUM('single', 'multiple');--> statement-breakpoint
CREATE TYPE "public"."poll_results" AS ENUM('admin', 'after_vote', 'public');--> statement-breakpoint
CREATE TYPE "public"."widget_status" AS ENUM('draft', 'live', 'paused', 'closed');--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" smallint NOT NULL,
	"hidden_at" timestamp with time zone,
	CONSTRAINT "poll_options_label_length" CHECK (char_length("poll_options"."label") BETWEEN 1 AND 120)
);
--> statement-breakpoint
ALTER TABLE "poll_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_poll_id_profile_id_option_id_pk" PRIMARY KEY("poll_id","profile_id","option_id")
);
--> statement-breakpoint
ALTER TABLE "poll_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "polls" (
	"widget_id" uuid PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"description" text,
	"choice" "poll_choice" DEFAULT 'single' NOT NULL,
	"max_choices" smallint,
	"results" "poll_results" DEFAULT 'admin' NOT NULL,
	"public_min_votes" smallint DEFAULT 10 NOT NULL,
	"allow_change" boolean DEFAULT false NOT NULL,
	CONSTRAINT "polls_question_length" CHECK (char_length("polls"."question") BETWEEN 1 AND 300),
	CONSTRAINT "polls_description_length" CHECK (char_length("polls"."description") <= 500),
	CONSTRAINT "polls_max_choices" CHECK ("polls"."max_choices" IS NULL OR "polls"."max_choices" >= 2),
	CONSTRAINT "polls_public_min_votes" CHECK ("polls"."public_min_votes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "polls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "widget_dismissals" (
	"widget_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"times" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "widget_dismissals_widget_id_profile_id_pk" PRIMARY KEY("widget_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "widget_dismissals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"status" "widget_status" DEFAULT 'draft' NOT NULL,
	"placements" text[] DEFAULT '{}'::text[] NOT NULL,
	"audience" jsonb DEFAULT '{"include":[],"exclude":[]}'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"priority" integer DEFAULT 0 NOT NULL,
	"published_reach" integer,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "widgets_kind_format" CHECK ("widgets"."kind" ~ '^[a-z][a-z0-9-]*$'),
	CONSTRAINT "widgets_title_length" CHECK (char_length("widgets"."title") BETWEEN 1 AND 120),
	CONSTRAINT "widgets_window" CHECK ("widgets"."starts_at" IS NULL OR "widgets"."ends_at" IS NULL OR "widgets"."ends_at" > "widgets"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "widgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_widget_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("widget_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_widget_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("widget_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_dismissals" ADD CONSTRAINT "widget_dismissals_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_dismissals" ADD CONSTRAINT "widget_dismissals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poll_options_poll_idx" ON "poll_options" USING btree ("poll_id","position");--> statement-breakpoint
CREATE INDEX "poll_votes_option_idx" ON "poll_votes" USING btree ("poll_id","option_id");--> statement-breakpoint
CREATE INDEX "widgets_live_idx" ON "widgets" USING btree ("priority") WHERE "widgets"."status" = 'live';