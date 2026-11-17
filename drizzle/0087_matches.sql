CREATE TYPE "public"."match_seeking" AS ENUM('players', 'gm', 'group');--> statement-breakpoint
CREATE TABLE "match_answers" (
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"yes" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_answers_from_id_to_id_pk" PRIMARY KEY("from_id","to_id"),
	CONSTRAINT "match_answers_not_self" CHECK ("match_answers"."from_id" <> "match_answers"."to_id")
);
--> statement-breakpoint
ALTER TABLE "match_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "match_cards" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"enabled_at" timestamp with time zone,
	"adult_confirmed_at" timestamp with time zone NOT NULL,
	"seeking" "match_seeking"[] NOT NULL,
	"online" boolean DEFAULT true NOT NULL,
	"in_person" boolean DEFAULT false NOT NULL,
	"axis_combat" smallint DEFAULT 50 NOT NULL,
	"axis_rules" smallint DEFAULT 50 NOT NULL,
	"axis_length" smallint DEFAULT 50 NOT NULL,
	"axis_tone" smallint DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_cards_seeking_some" CHECK (cardinality("match_cards"."seeking") BETWEEN 1 AND 3),
	CONSTRAINT "match_cards_format_some" CHECK ("match_cards"."online" OR "match_cards"."in_person"),
	CONSTRAINT "match_cards_axes_range" CHECK ("match_cards"."axis_combat" BETWEEN 0 AND 100 AND "match_cards"."axis_rules" BETWEEN 0 AND 100 AND "match_cards"."axis_length" BETWEEN 0 AND 100 AND "match_cards"."axis_tone" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "match_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_a" uuid NOT NULL,
	"profile_b" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by" uuid,
	CONSTRAINT "matches_ordered_pair" CHECK ("matches"."profile_a" < "matches"."profile_b")
);
--> statement-breakpoint
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_answers" ADD CONSTRAINT "match_answers_from_id_profiles_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_answers" ADD CONSTRAINT "match_answers_to_id_profiles_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_cards" ADD CONSTRAINT "match_cards_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_profile_a_profiles_id_fk" FOREIGN KEY ("profile_a") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_profile_b_profiles_id_fk" FOREIGN KEY ("profile_b") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_answers_to_idx" ON "match_answers" USING btree ("to_id");--> statement-breakpoint
CREATE INDEX "match_answers_from_created_idx" ON "match_answers" USING btree ("from_id","created_at");--> statement-breakpoint
CREATE INDEX "match_cards_enabled_idx" ON "match_cards" USING btree ("enabled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_pair_unique" ON "matches" USING btree ("profile_a","profile_b");--> statement-breakpoint
CREATE INDEX "matches_b_idx" ON "matches" USING btree ("profile_b");