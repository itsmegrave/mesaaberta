CREATE TABLE "player_ratings" (
	"table_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"score" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_ratings_table_id_player_id_pk" PRIMARY KEY("table_id","player_id"),
	CONSTRAINT "player_ratings_score_range" CHECK ("player_ratings"."score" BETWEEN 1 AND 5),
	CONSTRAINT "player_ratings_comment_length" CHECK (char_length("player_ratings"."comment") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "player_ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_player_id_profiles_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_ratings_player_idx" ON "player_ratings" USING btree ("player_id");