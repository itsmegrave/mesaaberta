CREATE TABLE "table_waitlist" (
	"table_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_waitlist_table_id_player_id_pk" PRIMARY KEY("table_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "table_waitlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "table_waitlist" ADD CONSTRAINT "table_waitlist_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_waitlist" ADD CONSTRAINT "table_waitlist_player_id_profiles_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "table_waitlist_order_idx" ON "table_waitlist" USING btree ("table_id","created_at");--> statement-breakpoint
CREATE INDEX "table_waitlist_player_idx" ON "table_waitlist" USING btree ("player_id");