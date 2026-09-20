CREATE TABLE "ratings" (
	"table_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"table_score" smallint NOT NULL,
	"gm_score" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_table_id_player_id_pk" PRIMARY KEY("table_id","player_id"),
	CONSTRAINT "ratings_table_score_range" CHECK ("ratings"."table_score" BETWEEN 1 AND 5),
	CONSTRAINT "ratings_gm_score_range" CHECK ("ratings"."gm_score" BETWEEN 1 AND 5),
	CONSTRAINT "ratings_comment_length" CHECK (char_length("ratings"."comment") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_registration_fk" FOREIGN KEY ("table_id","player_id") REFERENCES "public"."registrations"("table_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ratings_table_idx" ON "ratings" USING btree ("table_id");