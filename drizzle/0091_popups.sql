CREATE TYPE "public"."popup_trigger" AS ENUM('sign_in', 'page');--> statement-breakpoint
CREATE TABLE "popup_views" (
	"widget_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"shown_at" timestamp with time zone DEFAULT now() NOT NULL,
	"times" smallint DEFAULT 1 NOT NULL,
	"clicked_at" timestamp with time zone,
	CONSTRAINT "popup_views_widget_id_profile_id_pk" PRIMARY KEY("widget_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "popup_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "popups" (
	"widget_id" uuid PRIMARY KEY NOT NULL,
	"heading" text NOT NULL,
	"body" text NOT NULL,
	"cta_label" text NOT NULL,
	"cta_url" text NOT NULL,
	"image_url" text,
	"image_alt" text,
	"trigger" "popup_trigger" DEFAULT 'sign_in' NOT NULL,
	"allow_forever" boolean DEFAULT true NOT NULL,
	CONSTRAINT "popups_heading_length" CHECK (char_length("popups"."heading") BETWEEN 1 AND 80),
	CONSTRAINT "popups_body_length" CHECK (char_length("popups"."body") BETWEEN 1 AND 400),
	CONSTRAINT "popups_cta_label_length" CHECK (char_length("popups"."cta_label") BETWEEN 1 AND 40),
	CONSTRAINT "popups_cta_url_format" CHECK (char_length("popups"."cta_url") <= 500 AND (("popups"."cta_url" LIKE '/%' AND substr("popups"."cta_url", 2, 1) NOT IN ('/', chr(92))) OR "popups"."cta_url" LIKE 'https://%')),
	CONSTRAINT "popups_image_alt_length" CHECK (char_length("popups"."image_alt") <= 200),
	CONSTRAINT "popups_image_url_format" CHECK ("popups"."image_url" IS NULL OR (char_length("popups"."image_url") <= 1000 AND "popups"."image_url" ~ '^https?://'))
);
--> statement-breakpoint
ALTER TABLE "popups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "widget_dismissals" ADD COLUMN "hidden_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "popup_views" ADD CONSTRAINT "popup_views_widget_id_popups_widget_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."popups"("widget_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popup_views" ADD CONSTRAINT "popup_views_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popups" ADD CONSTRAINT "popups_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "popup_views_profile_idx" ON "popup_views" USING btree ("profile_id");